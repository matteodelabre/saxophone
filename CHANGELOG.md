# Changelog

## v0.3.0

### Breaking changes

* `Saxophone()` is now a constructor and no longer a factory function, so it should be prefixed by the `new` operator. Otherwise, an error will be thrown stating that a class cannot be called as a function.

### New features

* Instances now support streaming through the Node.js stream API. The previous `Saxophone#parse` API is still supported.

## v0.2.0

### Breaking changes

* To improve performance, attributes are no longer automatically parsed for every tag. Users should call `Saxophone#parseAttrs` whenever they actually want the attributes parsed.
* To improve performance, entities are no longer automatically decoded for every text chunk. Users should call `Saxophone#parseEntities` whenever they actually want to decode entities from a text.

