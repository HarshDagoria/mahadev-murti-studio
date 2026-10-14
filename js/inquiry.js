(function () {
  'use strict';

  var form = document.getElementById('inquiryForm');
  if (!form || form.dataset.inquiryBound === 'true') return;

  form.dataset.inquiryBound = 'true';
  form.addEventListener('submit', function () {
    if (form.dataset.inquirySubmitting === 'true') return;
    form.dataset.submittedAt = String(Date.now());
  });
})();