/* eslint-disable no-unused-vars */
'use strict';

const Benchmark = require('benchmark');
const fs = require('fs');
const path = require('path');

// benchmarked libraries:
const Saxophone = require('../dist');
const sax = require('sax');
const EasySax = require('easysax');

// test file:
const xml = fs.readFileSync(path.join(__dirname, 'fixture.xml')).toString();

(new Benchmark.Suite)
    .add('Saxophone', () => {
        const parser = Saxophone();
        let counter = 0;

        parser.on('tagopen', () => {
            counter += 1;
        });

        parser.on('tagclose', () => {
            counter += 1;
        });

        parser.on('text', () => {
            counter += 1;
        });

        parser.parse(xml);
    })
    .add('sax', () => {
        const parser = sax.parser(false);
        let counter = 0;

        parser.onopentag = () => {
            counter += 1;
        };

        parser.onclosetag = () => {
            counter += 1;
        };

        parser.ontext = () => {
            counter += 1;
        };

        parser.write(xml).close();
    })
    .add('EasySax', () => {
        const parser = new EasySax();
        let counter = 0;

        parser.on('startNode', (elem, attr) => {
            attr();
            counter += 1;
        });

        parser.on('endNode', () => {
            counter += 1;
        });

        parser.on('textNode', () => {
            counter += 1;
        });

        parser.parse(xml);
    })
    .on('cycle', ev => console.log(ev.target.toString()))
    .on('complete', function () {
        console.log('Fastest is ' + this.filter('fastest').map('name'));
    })
    .run({async: true});
