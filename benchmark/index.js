'use strict';

require('babel-register');

// benchmarking libraries
const Benchmark = require('benchmark');
const fs = require('fs');
const path = require('path');
const failsafe = require('./require-failsafe')();

// benchmarked libraries
const Saxophone = require('../dist');
const EasySax = failsafe.require('easysax');
const expat = failsafe.require('node-expat');
const libxmljs = failsafe.require('libxmljs');
const sax = failsafe.require('sax');

failsafe.commit();

// test file:
const xml = fs.readFileSync(path.join(__dirname, 'fixture.xml')).toString();

(new Benchmark.Suite)
    .add('Saxophone', () => {
        const parser = Saxophone();

        // force Saxophone to parse the attributes
        parser.on('tagopen', ({attrs}) => Saxophone.parseAttrs(attrs));

        parser.parse(xml);
    })
    .add('EasySax', () => {
        const parser = new EasySax();

        // force EasySax to parse the attributes
        parser.on('startNode', (elem, attr) => attr());

        parser.parse(xml);
    })
    .add('node-expat', () => {
        const parser = new expat.Parser('UTF-8');
        parser.write(xml);
    })
    .add('libxmljs.SaxParser', () => {
        const parser = new libxmljs.SaxParser();
        parser.parseString(xml);
    })
    .add('sax-js', () => {
        const parser = sax.parser(false);
        parser.write(xml).close();
    })

    .on('cycle', ev => console.log(ev.target.toString()))
    .on('complete', function () {
        console.log('Fastest is ' + this.filter('fastest').map('name'));
    })
    .run({async: true});
