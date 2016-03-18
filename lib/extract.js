var escape = require('escape-html'),
    marked = require('marked'),
    htmlParser = require('./html-parser'),
    postcss = require('postcss'),
    extractComments = require('esprima-extract-comments'),
    frontMatter = require('front-matter'),
    hideErrors = process.env.HIDE_ERRORS;

var FREEMARKER_PATTERN = /(\${.*})/;
var HBS_PATTERN = /({{.*})/;
var C_TYPE_MAP = {
  strong: 'bold',
  em: 'italic',
  link: 'link',
  hbs: 'x-handlebars-template',
  fm: 'x-freemarker-template',
  yml: 'x-yaml-front-matter'
}

marked.InlineLexer = require('./InlineLexer');

function extract(markdownStr, markdownFileName, skeletonFilename, srcLang, trgLang, options) {
    var skeleton = markdownStr;
    var content = frontMatter(markdownStr);
    var yamlTokens = Object.keys(content.attributes).map(function(key) {
      var value = content.attributes[key];
      return {
        type: 'yaml',
        text: escape(value),
        prop: key
      }
    });
    var mdTokens = marked.lexer(content.body, options);
    var tokens = yamlTokens.concat(mdTokens);
    tokens.links = mdTokens.links;
    var xliffUnits = [];
    var segmentCounter = 0;

    markdownFileName || (markdownFileName = 'source.md');
    skeletonFilename || (skeletonFilename = markdownFileName.split('.').shift() + '.skl.md');
    srcLang || (srcLang = 'ru-RU');
    trgLang || (trgLang = 'en-US');

    function addUnit(text, xml) {
        segmentCounter++;
        skeleton = skeleton.replace(text, '%%%' + segmentCounter + '%%%');

        xliffUnits.push([
            '<trans-unit id="' + segmentCounter + '">',
            '  <source xml:lang="' + srcLang + '">' + (xml || escape(text)) + '</source>',
            '  <target xml:lang="' + trgLang + '"></target>',
            '</trans-unit>'
        ].join('\n'));
    }

    function onCode(code, lang) {
        if (lang === 'css') {
            try {
                postcss.parse(code).walkComments(function(comment) {
                    addUnit(comment.text);
                });
            } catch(err) {
                hideErrors || console.log('postCSS was not able to parse comments. Code was saved as is.', err, code);
                addUnit(code);
            }

            return;
        }

        if (lang !== 'js') return addUnit(code);

        var comments;

        try {
            comments = extractComments.fromString(code);
        } catch(err) {
            try {
                comments = extractComments.fromString('(' + code + ')');
            } catch(err) {
                hideErrors || console.log('Esprima was not able to parse comments. Code was saved as is.', err, code);
                addUnit(code);
            }
        }

        comments && comments.forEach(function(comment) {
            addUnit(comment.value);
        });
    }

    function onHTML(text) {
        // TODO: handle HTML properly
        addUnit(text);
    }

    function onTable(table) {
        table.header.forEach(function(text) {
            addUnit(text);
        });
        table.cells.forEach(function(row) {
            row.forEach(function(text) {
                addUnit(text);
            });
        });
    }

    function onText(text) {
        var inlineTokens = marked.inlineLexer(text, tokens.links, options);
        var matchResult = text.match(/(.*)(<#[^>]*>)(\s*.*)\s*(<\/.*>)/) || [];
        var xml = null;
        if (matchResult.length > 0) {
          if (matchResult.length != 5) {
            var err = new Error('could not handle this freemarker syntax', inlineTokens);
            console.error(err);
            throw err;
          }
          var freemakerToken = {
            type: 'freemarker',
            text: matchResult[3],
            markup: [
              matchResult[2].replace(/</g, '&lt;'),
              matchResult[4].replace(/</g, '&lt;')
            ]
          };
          xml = [{type: 'text', text: matchResult[1]}, freemakerToken].map(onInlineToken).filter(Boolean).join('');
        } else {
          xml = inlineTokens.map(onInlineToken).filter(Boolean).join('');
        }

        xml && addUnit(text, xml);
    }

    function getTag(tag, id, content, attributes) {
        if (attributes == null) {
          attributes = {};
        }
        // TODO: support ctype for bpt
        var attributesAsString = Object.keys(attributes).map(function(key) {
          var value = attributes[key];
          return ' ' + key + '="' + value + '"';
        }).join('');
        return '<' + tag + ' id="' + id + '"' + attributesAsString + '>' + content + '</' + tag + '>';
    }

    function wrapPlaceholder(text, id,  type) {
      var ctype = C_TYPE_MAP[type] ? 'ctype="' + C_TYPE_MAP[type] + '"' : '';
      return '<ph id="' + id + '" ' + ctype + '>' + text + '</ph>';
    }

    function onInlineToken(token, idx) {
        var type = token.type,
            markup = token.markup;

        var ctype = C_TYPE_MAP[token.type];
        var attributes = {};
        if (ctype != null) {
          attributes.ctype = ctype;
        }
        debugger

        idx++; // is used to generate `id` starting with 1

        if (type === 'text') {
          if ((token.text.match(FREEMARKER_PATTERN) || []).length > 0) {
            return wrapPlaceholder(token.text, idx++, 'fm');
          }
          if ((token.text.match(HBS_PATTERN) || []).length > 0) {
            return wrapPlaceholder(token.text, idx++, 'hbs');
          }
          return escape(token.text);
        }

        if (['strong', 'em', 'del', 'code', 'autolink', 'nolink'].indexOf(type) > -1) {
            var text = escape(token.text)
            if ((token.text.match(FREEMARKER_PATTERN) || []).length > 0) {
              text = wrapPlaceholder(text, idx++, 'fm');
            }
            return getTag('bpt', idx, markup[0], attributes) +
                     text +
                getTag('ept', idx, markup[1]);
        }

        if (type === 'freemarker') {
          var insideLinkTokens = marked.inlineLexer(token.text, tokens.links, options);
          var serializedText = insideLinkTokens.map(onInlineToken).join('');

          return getTag('bpt', idx, markup[0], attributes) +
                  serializedText +
              getTag('ept', idx, markup[1]);
        }

        if (type === 'link' || type === 'reflink') {
            var insideLinkTokens = marked.inlineLexer(token.text, tokens.links, options),
                serializedText = insideLinkTokens.map(onInlineToken).join('');

            // image
            if (markup[0] === '!') return [
                getTag('bpt', idx, markup[0] + markup[1]),
                    serializedText,
                getTag('ept', idx, markup[2]),
                getTag('bpt', ++idx, markup[3]),
                    token.href,
                getTag('ept', idx, markup[4])
            ].join('');

            return getTag('bpt', 'l' + idx, markup[0], attributes) +
                    serializedText +
                (markup.length === 3 ? (
                    getTag('ept', 'l' + idx, markup[1][0]) +
                    getTag('bpt', 'l' + ++idx, markup[1][1], attributes) +
                        token.href +
                    getTag('ept', 'l' + idx, markup[2])
                    ) : getTag('ept', idx, markup[1])
                );
        }

        if (type === 'tag') {
            var tag = htmlParser(token.text)[0];

            if (tag && tag.attrs && (tag.type === 'img' || tag.type === 'iframe')) {
                tag.attrs.src && addUnit(tag.attrs.src);
                tag.attrs.alt && addUnit(tag.attrs.alt);
                return;
            }

            return getTag('ph', idx, escape(token.text));
        }

        if (type === 'br') return getTag('ph', idx, markup, {ctype: 'lb'});

        return token.text;
    }

    function onYaml(token) {
      var ctype = 'ctype="' + C_TYPE_MAP.yml + '"';
      var xml = '<ph id="1" ' + ctype + '>' + token.prop + '</ph>' + escape(token.text);
      xml && addUnit(null, xml);
    }

    tokens.forEach(function(token) {
      debugger
        var type = token.type;
        var text = token.text;
        if (type === 'table') return onTable(token);
        if (typeof text === 'undefined') return;

        if (type === 'code') return onCode(text, token.lang);
        if (type === 'html') return onHTML(text);
        if (type === 'yaml') return onYaml(token);
        // turn off splitting, see https://github.com/tadatuta/md2xliff/issues/5
        // Split into segments by `; `, `. `, `! ` and `? `
        // text.split(/[;|\.|!|\?]\s/).forEach(onText);
        onText(text);
    });

    // handle reflinks like
    // [ym]: https://github.com/ymaps/modules
    var reflinks = tokens.links;
    Object.keys(reflinks).forEach(function(linkKey) {
        var link = reflinks[linkKey];
        // TODO: translate link keys ?
        // TODO: check if such approach may replace other occurrence of a string
        addUnit(link.href);
        link.title && addUnit(link.title);
    });

    var xliff = [
        '<?xml version="1.0" encoding="UTF-8"?>',
        '<xliff xmlns="urn:oasis:names:tc:xliff:document:1.2" version="1.2">',
        '  <file original="' + markdownFileName + '"',
        '    source-language="' + srcLang + '" target-language="' + trgLang + '" datatype="markdown">',
        '    <header>',
        '      <skl>',
        '        <external-file href="' + skeletonFilename + '"/>',
        '      </skl>',
        '    </header>',
        '    <body>'
    ].concat(xliffUnits, [
        '    </body>',
        ' </file>',
        '</xliff>'
    ]).join('\n');

    return {
        skeleton: skeleton,
        xliff: xliff
    };
}

module.exports = extract;
