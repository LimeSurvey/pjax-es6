# Pjax

This is a fork of the original Pjax built by Maxime Thirouin.

It has been altered to be es6 compatible and I changed the build system to rollup.

> Easily enable fast Ajax navigation on any website (using pushState +  xhr)

Pjax is a standalone JavaScript module that uses
ajax (XmlHttpRequest) and
[pushState()](https://developer.mozilla.org/en-US/docs/Web/Guide/API/DOM/Manipulating_the_browser_history)
to deliver a fast browsing experience.

_It allow you to completely transform user experience of standard websites
(server side generated or static ones) to make them feel they browse an app.
Especially for user that have low bandwidth connection._

**No more full page reload. No more lots of HTTP request.**

This is a heavily modded version for usage in combination with the [LimeSurvey Survey application] (https://limesurvey.org).
The original which is still profiting from this version is the original at [MoOx](https://github.com/MoOx/pjax)

This version has somehow strayed from the original version.
Some changes are not compatible, and may break older pages using pjax. 

## Demo

Pjax is in heavy use in the adminpanel of Limesurvey currently.
A demo of this is available at https://demo.limsurvey.org/admin

## How Pjax works

Pjax loads page using ajax & updates the browser's current url using pushState without reloading your page's layout or any resources (js, css), giving a fast page load.
_But under the hood, it's just ONE http request with a pushState() call._
Obviously, for [browsers that don't support pushState()](http://caniuse.com/#search=pushstate) Pjax fully degrades (yeah, it doesn't do anything at all).

It simply works with all permalinks & can update all parts of the page you
want (including html metas, title, navigation state).

- It's not limited to one container, like jQuery-Pjax is,
- It fully support browser history (back & forward buttons),
- It **will** support keyboard browsing (@todo),
- Automatically fallback to classic navigation for externals pages (thanks to Capitain Obvious help),
- Automatically fallback to classic navigation for internals pages that will not have the appropriated DOM tree,
- You can add pretty cool CSS transitions (animations) very easily.
- It's around 3kb (minified & gzipped).

### Under the hood

- It listen to every clicks on links _you want_ (by default all of them),
- When an internal link is clicked, Pjax grabs HTML from your server via ajax,
- Pjax render pages DOM tree (without loading any resources - images, css, js...)
- It check if all defined parts can be replaced:
    - if page doesn't suit requirement, classic navigation used,
    - if page suits requirement, Pjax does all defined DOM replacements
- This version of Pjax will also check if the css differs from the former pages head and update it accordingly
- Also will this version of pjax reload scripts that are loaded remotely and trigger an event when they are laoded completely
- Then, it updates the browser's current url using pushState

## Overview

Pjax is fully automatic. You won't need to setup anything on the existing HTML.
You just need to designate some elements on your page that will be replaced when
you navigate your site.

Consider the following page.

```html
<!doctype html>
<html>
<head>
  <!-- metas, title, styles, ... -->
</head>
<body>
  <header class="my-Header"><nav><!-- a .is-active is in there --></nav></header>
  <section class="my-Content">
    Sha blah <a href="/blah ">blah</a>.
  </section>
  <aside class="my-Sidebar">Sidebar stuff</aside>
  <footer class="my-Footer"></footer>
  <script src="onDomReadystuff.js"></script>
  <script><!-- analytics --></script>
</body>
</html>
```

We want Pjax to grab the url `/blah` then replace `.my-Content` with whatever it gets back.
Oh and the `<nav>` (that contains a status marker somewhere) can be updated too (or stay the same, as you wish).
And also the `<aside>` please.
So we want to update `[".my-Header", ".my-Content", ".my-Sidebar"]`, **without reloading styles nor scripts that are not inside the elements**.

We do this by telling Pjax to listen on `a` tags and use CSS selectors defined above (without forgetting minimal meta):

``` javascript
new Pjax({ selectors: ["title", ".my-Header", ".my-Content", ".my-Sidebar"] })
```

Now when someone in a Pjax-compatible browser clicks "blah" the content of all selectors will be replaced with the one found in the "blah" content.

_Magic! For real!_ **There is completely no need to do anything on server side!**

## Differences with [jQuery-pjax](https://github.com/defunkt/jquery-pjax)

- No jQuery dependency,
- Not limited to a container,
- No server side requirements,
- Works for CommonJS environment (browserify), AMD (RequireJS) or even globally,
- Allow page transition with CSS animations,
- Can be easily hacked since every method is public (so overridable)

## Installation

Currently this version needs to be downloaded seperately
Pjax can obviously be downloaded directly.

## No dependencies

_There is nothing you need. No jQuery or something._


## Compatibility

Pjax only works with [browsers that support the `history.pushState` API](http://caniuse.com/#search=pushstate).
When the API isn't supported Pjax goes into fallback mode (it just does nothing).

To see if Pjax is actually supported by your browser, use `Pjax.isSupported()`.

This version uses Promises, so you either have to use a non IE browser, or depend on a small shim.
Productive use currently is with this one: https://github.com/stefanpenner/es6-promise

## Usage

### `new Pjax()`

Let's talk more about the most basic way to get started:

```js
new Pjax({
  elements: "a", // default is "a[href], form[action]"
  selectors: ["title", ".my-Header", ".my-Content", ".my-Sidebar"]
})
```

This will enable Pjax on all links and designate the part to replace using CSS selectors `"title", ".my-Header", ".my-Content", ".my-Sidebar"`.

For some reason, you might want to just target some elements to apply Pjax behavior.
In that case, you can 2 differents things:

- use a custom selector like "a.js-Pjax" or ".js-Pjax a" depending on what you want.
- override `Pjax.prototype.getElements` that just basically `querSelectorAll` the `elements` option. In this function you just need to return a `NodeList`.

```js
// use case 1
new Pjax({ elements: "a.js-Pjax" })


// use case 2
Pjax.prototype.getElements = function() {
  return document.getElementsByClassName(".js-Pjax")
}

new Pjax({})
```

When instanciating a `Pjax` object, you need to pass all options as an object:

#### Options

##### `elements` (String, default "a[href], form[action]")

CSS Selector to use to retrieve links to apply Pjax

This version also works on forms, so a form put into this list, will be submitted through pjax.

##### `selectors` (Array, default ["title", ".js-Pjax"])

CSS Selectors to replace. If a query returns multiples items, it will just keep the index.

Example of what you can do:

```html
<!doctype html>
<html>
<head>
  <title>Page title</title>
</head>
<body>
  <header class="js-Pjax"></header>
  <section class="js-Pjax">...</section>
  <footer class="my-Footer"></footer>
  <script>...</script>
</body>
</html>
```

This example is correct and should work "as expected".
_If there is not the same amount of DOM element from current page and new page,
the Pjax behavior will fallback to normal page load._

##### `switches` (Object, default {})

Objects containing callbacks that can be used to switch old element with new element.
Keys should be one of the defined selector.

Examples:

```js
new Pjax({
  selectors: ["title", ".Navbar", ".js-Pjax"],
  switches: {
    // "title": Pjax.switches.outerHTML // default behavior
    ".Navbar": function(oldEl, newEl, options) {
      // here it's a stupid example since it's the default behavior too
      oldEl.outerHTML = newEl.outerHTML
      this.onSwitch()
    },

    ".js-Pjax": Pjax.switches.sideBySide
  }
})
```

Callbacks are binded to Pjax instance itself to allow you to reuse it (ex: `this.onSwitch()`)

###### Existing switches callback

- `Pjax.switches.outerHTML`: default behavior, replace elements using outerHTML
- `Pjax.switches.innerHTML`: replace elements using innerHTML & copy className too
- `Pjax.switches.sideBySide`: smart replacement that allow you to have both elements in the same parent when you want to use CSS animations. Old elements are removed when all childs have been fully animated ([animationEnd](http://www.w3.org/TR/css3-animations/#animationend) event triggered)

###### Create a switch callback

Your function can do whatever you want, but you need to:

- replace oldEl content by newEl content in some fashion
- call `this.onSwitch()` to trigger attached callback.

Here is the default behavior as example

```js
function(oldEl, newEl, pjaxRequestOptions, switchesClasses) {
  oldEl.outerHTML = newEl.outerHTML
  this.onSwitch()
}
```

##### `switchesOptions` (Object, default {})

This are options that can be used during switch by switchers ( for now, only `Pjax.switches.sideBySide` use it).
Very convenient when you use something like [Animate.css](https://github.com/daneden/animate.css)
with or without [WOW.js](https://github.com/matthieua/WOW).

```js
new Pjax({
  selectors: ["title", ".js-Pjax"],
  switches: {
    ".js-Pjax": require("pjax/lib/switches.js").sideBySide
  },
  switchesOptions: {
    ".js-Pjax": {
      classNames: {
        // class added on the element that will be removed
        remove: "Animated Animated--reverse Animate--fast Animate--noDelay",
        // class added on the element that will be added
        add: "Animated",
        // class added on the element when it go backward
        backward: "Animate--slideInRight",
        // class added on the element when it go forward (used for new page too)
        forward: "Animate--slideInLeft"
      },
      callbacks: {
        // to make a nice transition with 2 pages as the same time
        // we are playing with absolute positioning for element we are removing
        // & we need live metrics to have something great
        // see associated CSS below
        removeElement: function(el) {
          el.style.marginLeft = "-" + (el.getBoundingClientRect().width/2) + "px"
        }
      }
    }
  }
})
```
_Note that remove class include `Animated--reverse` which is a simple way to not have
to create duplicate transition for (slideIn + reverse => slideOut)._

The following CSS will be required to make something nice

```css
/*
  if your content elements doesn't have a fixed width,
  you can get issue when absolute positioning will be used
  so you will need that rules
*/
.js-Pjax { position: relative } /* parent element where switch will be made */

  .js-Pjax-child { width: 100% }

  /* position for the elements that will be removed */
  .js-Pjax-remove {
    position: absolute;
    left: 50%;
    /* transform: translateX(-50%) */
    /* transform can't be used since we already use generic translate for the remove effect (eg animate.css) */
    /* margin-left: -width/2; // made with js */
    /* you can totally drop the margin-left thing from switchesOptions if you use custom animations */
  }

/* CSS animations */
.Animated {
  animation-fill-mode: both;
  animation-duration: 1s;
}

  .Animated--reverse { animation-direction: reverse }

  .Animate--fast { animation-duration: .5s }
  .Animate--noDelay { animation-delay: 0s !important;  }

  .Animate--slideInRight { animation-name: Animation-slideInRight }
  @keyframes Animation-slideInRight {
    0% {
      opacity: 0;
      transform: translateX(100rem);
    }

    100% {
      transform: translateX(0);
    }
  }

  .Animate--slideInLeft { animation-name: Animation-slideInLeft }
  @keyframes Animation-slideInLeft {
    0% {
      opacity: 0;
      transform: translateX(-100rem);
    }

    100% {
      transform: translateX(0);
    }
  }
```

To get understand this CSS, here is a HTML snippet


```html
<!doctype html>
<html>
<head>
  <title>Page title</title>
</head>
<body>
  <section class="js-Pjax">
    <div class="js-Pjax-child">
      Your content here
    </div>
    <!--
    when switching will be made you will have the following tree
    <div class="js-Pjax-child js-Pjax-remove Animate...">
      Your OLD content here
    </div>
    <div class="js-Pjax-child js-Pjax-add Animate...">
      Your NEW content here
    </div>
    -->
  </section>
  <script>...</script>
</body>
</html>
```

##### `history` (Boolean, default true)

Enable pushState. Only disable if you are crazy.
Internaly, this option is used when `popstate` is used (to not pushState again).
You should forget that option.

##### `analytics` (Function, default to a function that push `_gaq` `trackPageview` or send `ga` `pageview`

Function that allow you to add behavior for analytics. By default it try to track
a pageview with Google Analytics.
It's called every time a page is switched, even for history buttons.

##### `scrollTo` (Integer, default to 0)

Value (in px) to scrollTo when a page is switched.

##### `cacheBust` (Boolean, default true)

When set to true,
append a timestamp query string segment to the requested URLs
in order to skip browser cache.

##### `debug` (Boolean, default to false)

Enable verbose mode & doesn't use fallback when there is an error.
Useful to debug page layout differences.

##### `currentUrlFullReload` (Boolean, default to false)

When set to true, clicking on a link that point the current url trigger a full page reload.

### Events

Pjax fires a number of events regardless of how its invoked.

All events are fired from the _document_, not the link was clicked.

#### Ajax related events

* `pjax:send` - Fired after the Pjax request begins.
* `pjax:complete` - Fired after the Pjax request finishes.
* `pjax:success` - Fired after the Pjax request succeeds.
* `pjax:error` - Fired after the Pjax request fails. Returning false will prevent the the fallback redirect.
* `pjax:scriptcomplete` - Fired after the Pjax request finishes loading remote scripts.
* `pjax:scriptsuccess` - Fired after the Pjax request succeeds loading remote scripts.
* `pjax:scripterror` - Fired after the Pjax loading of remote scripts fails. Returning false will prevent the the fallback redirect.
* `pjax:scripttimeout` - Fired after the Pjax loading of remote scripts takes too long. This happens a.e. when a script is already loaded and can't be grabbed from cache.

`send` and `complete` are a good pair of events to use if you are implementing a loading indicator (eg: [topbar](http://buunguyen.github.io/topbar/))

```js
$(document).on('pjax:send', topbar.show)
$(document).on('pjax:complete', topbar.hide)
```

#### Note about DOM ready state

Most of the time, you have code attached & related to the current DOM, that you only execute when page/dom is ready.
Since Pjax doesn't magically rexecute you previous code each time you load a page, you need to make a simple thing to rexecute appropriate code:

```js
function whenDOMReady() {
  // do you stuff
}

whenDOMReady()

new Pjax()

document.addEventListener("pjax:success", whenDOMReady)
```
This version has a two steps loading process.
So if you are loading a function from a remote script, you should not wait until you can be sure it is loaded and available.
So in the case of waiting for the script you should use:

```js
function whenDOMReady() {
  // do you stuff
}

whenDOMReady()

new Pjax()

document.addEventListener("pjax:scriptcomplete", whenDOMReady)
```
Better to use scriptcomplete, since caching issues can lead to the script being completely loaded, but the load event not being fired.

_Note: Don't create the Pjax in the `whenDOMReady` function._


```js
// do your global stuff
//... dom ready blah blah

function whenContainerReady() {
  // do your container related stuff
}
whenContainerReady()

new Pjax()

document.addEventListener("pjax:success", whenContainerReady)
```

---

## CONTRIBUTING

For contributing, that does not involve any of the special methods mentioned here, please contribute to the original: https://github.com/MoOx/pjax

Else pull request are welcome, but may take time to be processed

## [LICENSE](LICENSE)
Project sourcecode Copyright (c) 2014 Maxime Thirouin

The fork happened on th 4th of November 2017
Differing sourcecode from the original is licensed under the GPLv3.
with Copyright (c) 2017 Markus Flür/LimeSurvey GmbH
