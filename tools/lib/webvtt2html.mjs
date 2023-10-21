import webvttParser from 'webvtt-parser';

const parser = new webvttParser.WebVTTParser();

export async function convert(vttUrl, options) {
  options = options || {};

  function cleanSentence(sentence) {
    if (options.clean) {
      sentence = sentence.replace(/^slide [a-z0-9]*\.?/i, '');
      sentence = sentence.replace(/^next slide\.?/i, '');
      sentence = sentence.replace(/^next page\.?/i, '');
      sentence = sentence.replace(/^moving to next slide\.?/i, '');
      sentence = sentence.replace(/^moving to next page\.?/i, '');
      sentence = sentence.replace(/, you know, ?/g, ' ');
    }
    return sentence;
  }

  const response = await fetch(vttUrl);
  const vtt = await response.text();

  let cues;
  try {
    ({cues} = parser.parse(vtt));
  } catch (e) {
    console.error(`Could not parse ${vttUrl} as WebVTT: ` + e);
    process.exit(1);
  }

  cues.forEach(c => c.text = c.text
    .replace(/<v [^>]*>/, '')
    .replace(/<\/v>/, '')
    .replace('"',''));
  if (options.clean) {
    cues.forEach(c => c.text = c.text.replace(/^slide [0-9]+$/i, ''));
  }

  const divs = [{
    slide: "1",
    paragraphs: []
  }];
  let p = '';
  cues.forEach(c => {
    if (c.id.startsWith("slide-")) {
      if (cleanSentence(p)) {
        divs[divs.length-1].paragraphs.push(cleanSentence(p));
      }
      divs.push({
        slide: c.id.substring("slide-".length),
        paragraphs: []
      });
      p = '';
    } else if (c.id.endsWith("-p")) {
      if (cleanSentence(p)) {
        divs[divs.length-1].paragraphs.push(cleanSentence(p));
        p = c.text;
      }
      p = '';
    } else if (c.text.match(/:/)) {
      if (cleanSentence(p)) {
        divs[divs.length-1].paragraphs.push(cleanSentence(p));
        p = c.text;
      }
      p = '';
    }
    p += (p ? ' ' : '') + c.text;
  });

  // Output final sentence
  if (cleanSentence(p)) {
    divs[divs.length-1].paragraphs.push(cleanSentence(p));
  }

  let content = '';
  let pid = 1;
  if (options.splitPerSlide) {
    for (let i = 0 ; i < divs.length; i++) {
      if (options.slideset) {
        content += `<div id="ts-${divs[i].slide}">`;
        content += `<i-slide src="${options.slideset}#${divs[i].slide}" class="slide">Slide ${divs[i].slide} of ${divs.length}</i-slide>\n`;
      }
      content += (options.markupStart || `<div>`) + "\n";

      for (const p of divs[i].paragraphs) {
        const match = p.match(/^(.*):\s*(.*)$/);
        if (match) {
          content += `  <p id="tp-${pid}"><cite>${match[1]}:</cite> ${match[2]}</p>\n`;
        }
        else {
          content += `  <p id="tp-${pid}">${p}</p>\n`;
        }
        pid += 1;
      }
      content += (options.markupEnd || '</div>') + "\n\n";
      if (options.slideset) {
        content += `</div>`;
      }
    }
  } else {
    let last = '';
    content += '<p>';
    for (const p of divs.map(d => d.paragraphs).flat().flat()) {
      const match = p.match(/^(.*):\s*(.*)$/);
      if (match) {
        if (last && match[1] === last) {
          content += `<br/>\n  … ${match[2]}`;
        }
        else {
          content += `</p>\n  <p><cite>${match[1]}:</cite> ${match[2]}`;
        }
        last = match[1];
      }
      else {
        content += `</p>\n  ${p}`;
      }
    }
  }

  return content;
}
