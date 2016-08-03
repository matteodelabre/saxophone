# Saxophone 🎷

Fast and lightweight event-driven XML parser in pure JavaScript.

[![npm version](https://img.shields.io/npm/v/saxophone.svg?style=flat-square)](https://www.npmjs.com/package/saxophone)
[![npm downloads](https://img.shields.io/npm/dm/saxophone.svg?style=flat-square)](https://www.npmjs.com/package/saxophone)
[![build status](https://img.shields.io/travis/matteodelabre/saxophone.svg?style=flat-square)](https://travis-ci.org/matteodelabre/saxophone)
[![coverage](https://img.shields.io/coveralls/matteodelabre/saxophone.svg?style=flat-square)](https://coveralls.io/github/matteodelabre/saxophone)
[![dependencies status](http://img.shields.io/david/matteodelabre/saxophone.svg?style=flat-square)](https://david-dm.org/matteodelabre/saxophone)

Saxophone is inspired from SAX parsers: it does not generate any
DOM while parsing documents. Instead, it reports parsing events
for each tag or text node encountered. This means that Saxophone
has a really low memory footprint.

The parser does not keep track of the document state while parsing
and does not check whether the document is well-formed or valid,
making it super-fast (see [benchmarks](#benchmarks) below).

This library is best suited when you need to extract simple data
out of an XML file received from a source that you trust in emitting
well-formed documents, such as an API endpoint.

Inspired by SAX libraries such as
[sax-js](https://github.com/isaacs/sax-js) and
[easysax.](https://github.com/vflash/easysax)

## Installation

This library works both in Node.JS and recent browsers.
To install with `npm`:

```sh
$ npm install --save saxophone
```

## Example

```js
const Saxophone = require('saxophone');
const parser = Saxophone();

// called whenever an opening tag is found in the document,
// such as <example id="1" /> - see below for a list of events
parser.on('tagopen', tag => {
    console.log(
        `Open tag "${tag.name}" with attributes: ${JSON.stringify(tag.attributes)}.`
    );
});

// called when parsing the document is done
parser.on('end', () => {
    console.log('Parsing finished.');
});

// triggers parsing - remember to set up listeners before
// calling this method
parser.parse('<root><example id="1" /><example id="2" /></root>');
```

Output:

```sh
Open tag "root" with attributes: {}.
Open tag "example" with attributes: {"id":"1"}.
Open tag "example" with attributes: {"id":"2"}.
Parsing finished.
```

## Benchmarks

| Library            | Operations per second (higher is better) |
|--------------------|-----------------------------------------:|
| **Saxophone**      | **3,222 ops/sec ±5.39%**                 |
| EasySax            | 2,128 ops/sec ±8.87%                     |
| node-expat         | 884 ops/sec ±5.39%                       |
| libxmljs.SaxParser | 609 ops/sec ±4.61%                       |
| sax-js             | 113 ops/sec ±3.87%                       |

To run the benchmark by yourself, clone the repo,
install the development dependencies and run the
benchmark command.

```sh
$ git clone https://github.com/matteodelabre/saxophone.git
$ cd saxophone
$ npm install
$ npm install easysax node-expat libxmljs sax
$ npm run benchmark
```

## API

### `Saxophone()`

Returns a new Saxophone instance. This is a factory method,
so you **must not prefix it with the `new` keyword.**

### `Saxophone#on()`, `Saxophone#removeListener()`, ...

Saxophone composes with the EventEmitter methods. To work
with listeners, check out [Node's documentation.](https://nodejs.org/api/events.html)

### `Saxophone#parse(xml)`

Triggers the actual parsing. This method will fire registered listeners
so you need to set them up before calling it.

`xml` is a string containing the XML that you want to parse. At this
time, Saxophone does not support `Buffer`s or `Stream`s.
