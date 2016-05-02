process.env.USE_SOURCE = true

const fs = require('fs')
const assert = require('assert')
const md2xliff = require('..')

function convertToXliffAndBack (untrimmed, checkCallback, done) {
  const content = untrimmed.trim()
  const extracted = md2xliff.extract(content, 'temp-file')

  fs.writeFileSync('tmp.xlf', extracted.xliff)
  fs.writeFileSync('tmp.skl', extracted.skeleton)
  checkCallback(extracted.xliff, extracted.skeleton)

  md2xliff.reconstruct(extracted.xliff, extracted.skeleton, function (err, translatedMarkdown) {
    if (err) {
      throw new Error(err)
    }
    try {
      assert.equal(content, translatedMarkdown)
      done()
    } catch (err) {
      console.log('Expected:', content)
      console.log('Actual result:', translatedMarkdown)
      throw new Error(err)
    }
  })
}

const describe = global.describe
const it = global.it

describe('md to xliff', () => {
  it('simple markdown', (done) => {
    const template = `
# simple heading

with a paragraph
`
    convertToXliffAndBack(template, (xliff, sklt) => {
      assert.ok(xliff.indexOf('simple heading') !== -1, 'simple text')
      assert.ok(sklt.indexOf('# %%%1%%%') !== -1, 'h1 sklt replacement')
    }, done)
  })

  it('markdown with a <span> wrapper', (done) => {
    const template = `
<span>with a paragraph</span>
`
    convertToXliffAndBack(template, (xliff, sklt) => {
      assert.ok(xliff.indexOf('<ph id="1">&lt;span&gt;</ph>with a paragraph<ph id="3">&lt;/span&gt;</ph>') !== -1, 'md span')
      assert.ok(sklt.indexOf('%%%1%%%') !== -1, 'md span sklt replacement')
    }, done)
  })

  it('markdown with a <div> wrapper', (done) => {
    const template = `
<div>with a paragraph</div>
`
    convertToXliffAndBack(template, (xliff, sklt) => {
      assert.ok(xliff.indexOf('<ph id="1">&lt;div&gt;</ph>with a paragraph<ph id="3">&lt;/div&gt;</ph>') !== -1, 'md div')
      assert.ok(sklt.indexOf('%%%1%%%') !== -1, 'md div sklt replacement')
    }, done)
  })

  it('frontmatter (yaml)', (done) => {
    const template = `
---
foo: bar
qux: 'frontmatter with: a colon'
---
`
    convertToXliffAndBack(template, (xliff, sklt) => {
      assert.ok(xliff.indexOf('<ph id="1" ctype="x-yaml-front-matter"></ph>frontmatter with: a colon') !== -1, 'front-matter')
      assert.ok(sklt.indexOf('foo: %%%1%%%') !== -1, 'front-matter')
    }, done)
  })

  it('handlebars partial', (done) => {
    const template = `
{{> finalClause }}
`
    convertToXliffAndBack(template, (xliff, sklt) => {
      assert.ok(xliff.indexOf('<ph id="1" ctype="x-handlebars-template">{{> finalClause }}</ph>') !== -1, 'hbs partial')
      assert.ok(sklt.indexOf('%%%1%%%') !== -1, 'hbs partial sklt replacement')
    }, done)
  })

  it('handlebars helper', (done) => {
    const template = `
{{ subheader }}
`
    convertToXliffAndBack(template, (xliff, sklt) => {
      assert.ok(xliff.indexOf('<ph id="1" ctype="x-handlebars-template">{{ subheader }}</ph>') !== -1, 'hbs helper')
      assert.ok(sklt.indexOf('%%%1%%%') !== -1, 'hbs helper sklt replacement')
    }, done)
  })

  it('freemarker inline placeholder', (done) => {
    const template = `
foobar: <#if customer.flag != '!empty'>\${customer.flag}</#if>
`
    convertToXliffAndBack(template, (xliff, sklt) => {
      assert.ok(xliff.indexOf('foobar: <ph id="1" ctype="x-freemarker-template">&lt;#if customer.flag != \'!empty\'>${customer.flag}&lt;/#if></ph>') !== -1, 'freemarker inline')
      assert.ok(sklt.indexOf('%%%1%%%') !== -1, 'freemarker inline sklt replacement')
    }, done)
  })

  it('freemarker list directive within <div>', (done) => {
    const template = `
<div><#list some freemarker magic </#list></div>
`
    convertToXliffAndBack(template, (xliff, sklt) => {
      assert.ok(xliff.indexOf('<ph id="1" ctype="x-freemarker-template">&lt;div>&lt;#list some freemarker magic &lt;/#list>&lt;/div></ph>') !== -1, 'freemarker block-div')
      assert.ok(sklt.indexOf('%%%1%%%') !== -1, 'freemarker directive sklt replacement')
    }, done)
  })

  it('freemarker list directive without <div>', (done) => {
    const template = `
<#list some freemarker magic </#list>
`
    convertToXliffAndBack(template, (xliff, sklt) => {
      assert.ok(xliff.indexOf('<ph id="1" ctype="x-freemarker-template">&lt;#list some freemarker magic &lt;/#list></ph>') !== -1, 'freemarker block-no-div')
      assert.ok(sklt.indexOf('%%%1%%%') !== -1, 'freemarker directive sklt replacement')
    }, done)
  })

  it('freemarker list directive with a handlebars partial', (done) => {
    const template = `
<#list customer.contactroles as contact>{{> normalContact }}</#list>
`
    convertToXliffAndBack(template, (xliff, sklt) => {
      assert.ok(xliff.indexOf('<ph id="1" ctype="x-freemarker-template">&lt;#list customer.contactroles as contact>{{> normalContact }}&lt;/#list></ph>') !== -1, 'freemarker-hbs')
      assert.ok(sklt.indexOf('%%%1%%%') !== -1, 'freemarker + hbs sklt replacement')
    }, done)
  })
})
