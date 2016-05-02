---
subject: wtf!!!
special: "Hello, it's the: world"
---
<span>span content</span>

<div>simple block content</div>

<#list customer.contactroles as contact>{{> normalContact }}</#list>

<div><#list some freemarker magic </#list></div>

<#list some freemarker magic </#list>

foobar: <#if customer.flag != '!empty'>${customer.flag}</#if>

{{> finalClause }}
