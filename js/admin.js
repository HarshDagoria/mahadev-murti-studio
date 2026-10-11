(function () {
  'use strict';

  const api = window.MahadevAdmin || {};
  const firebaseApi = window.MahadevFirebase;
  const list = document.getElementById('inquiriesList');
  const statuses = ['new', 'contacted', 'completed', 'cancelled'];

  function dateLabel(value) {
    if (!value) return 'Date pending';
    const date = typeof value.toDate === 'function' ? value.toDate() : new Date(value);
    return Number.isNaN(date.getTime()) ? 'Date pending' : date.toLocaleString();
  }

  function renderInquiries(items) {
    if (!list) return;
    if (!items.length) {
      list.innerHTML = '<p class="sub">No inquiries yet.</p>';
      return;
    }
    list.innerHTML = items.map(item => `
      <article class="inquiry-card" data-inquiry-id="${item.id}">
        <strong>${item.name || 'Unnamed visitor'}</strong>
        <p>${[item.email, item.phone, item.projectType, item.budget].filter(Boolean).join(' · ')}</p>
        <p>${item.message || ''}</p>
        <div class="inquiry-meta">${dateLabel(item.createdAt)}</div>
        <div class="inquiry-actions">
          <select class="inquiry-status" aria-label="Inquiry status">
            ${statuses.map(status => `<option value="${status}" ${status === item.status ? 'selected' : ''}>${status}</option>`).join('')}
          </select>
          <button type="button" class="wc-delete inquiry-delete">Delete</button>
        </div>
      </article>
    `).join('');

    list.querySelectorAll('.inquiry-status').forEach(select => {
      select.addEventListener('change', async () => {
        const card = select.closest('.inquiry-card');
        await firebaseApi.updateInquiry(card.dataset.inquiryId, select.value);
      });
    });
    list.querySelectorAll('.inquiry-delete').forEach(button => {
      button.addEventListener('click', async () => {
        const card = button.closest('.inquiry-card');
        await firebaseApi.deleteInquiry(card.dataset.inquiryId);
        card.remove();
      });
    });
  }

  api.loadInquiries = async function () {
    if (!firebaseApi || !list) return;
    try {
      renderInquiries(await firebaseApi.listInquiries());
    } catch (error) {
      list.innerHTML = '<p class="sub">Sign in with the admin account to view inquiries.</p>';
    }
  };

  async function loadRemoteWorks() {
    if (!firebaseApi || typeof window.loadAdminWorks !== 'function') return;
    try {
      const remote = await firebaseApi.loadWorks();
      const local = window.loadAdminWorks();
      const localCodes = new Set(local.map(work => work.code));
      remote.forEach(work => {
        if (!localCodes.has(work.code)) local.push(work);
      });
      window.saveAdminWorks(local);
      if (typeof window.renderAll === 'function') window.renderAll();
    } catch (error) {
      // The existing local fallback remains available.
    }
  }

  window.MahadevAdmin = api;
  loadRemoteWorks();
  api.loadInquiries();
})();
