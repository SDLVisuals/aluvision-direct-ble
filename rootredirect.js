/* Keep legacy bookmarks on the current, isolated browser demonstration. */
(function () {
  'use strict';
  var destination = new URL('./demo/', window.location.href);
  destination.search = window.location.search;
  destination.hash = window.location.hash;
  window.location.replace(destination.href);
}());
