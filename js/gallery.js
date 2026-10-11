(function () {
  'use strict';

  // The public page currently owns the gallery renderer in its inline script.
  // Keep this entry point available for gallery-specific enhancements without
  // assuming the page has loaded the gallery markup.
  window.MahadevGallery = window.MahadevGallery || {
    refresh: function () {
      if (typeof window.renderGallery === 'function') window.renderGallery();
    }
  };
})();
