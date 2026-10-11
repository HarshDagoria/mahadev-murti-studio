// =========================================================
// Firebase Integration — Auth and Firestore helpers.
// =========================================================

const CLOUDINARY_CLOUD_NAME = 'ucgz38l0';
const CLOUDINARY_UPLOAD_PRESET = 'mahadev_test';
const CLOUDINARY_UPLOAD_URL = 'https://api.cloudinary.com/v1_1/ucgz38l0/image/upload';
const CLOUDINARY_MAX_FILE_SIZE = 10 * 1024 * 1024;

// Shared Firestore API used by both existing pages.
(function createMahadevFirebase() {
  const api = window.MahadevFirebase || {};
  let app = null;
  let auth = null;
  let db = null;

  function config() {
    return window.MAHADEV_FIREBASE_CONFIG || window.firebaseConfig || null;
  }

  function configured() {
    const value = config() || {};
    return !!value.apiKey && !String(value.apiKey).startsWith('YOUR_') && !!value.projectId;
  }

  function start() {
    if (app) return true;
    if (!configured() || typeof firebase === 'undefined') return false;
    try {
      app = firebase.apps.length ? firebase.app() : firebase.initializeApp(config());
      auth = firebase.auth();
      db = firebase.firestore();
      return true;
    } catch (error) {
      return false;
    }
  }

  async function requireAdmin() {
    const started = start();
    const user = started && auth ? auth.currentUser : null;
    console.info('[Mahadev Auth] admin operation check', {
      firebaseStarted: started,
      uid: user ? user.uid : null,
      email: user ? user.email : null,
      provider: user && user.providerData[0] ? user.providerData[0].providerId : null
    });
    if (!user || !user.email) {
      throw new Error('Please sign in with the admin email account.');
    }
    return user;
  }

  function normaliseWork(data) {
    return {
      ...data,
      cat: data.category || data.cat || 'mural',
      meta: data.description || data.meta || '',
      img: data.imageUrl || data.img || '',
      builtin: false
    };
  }

  async function signIn(email, password) {
    if (!start()) throw new Error('Firebase configuration is missing.');
    return auth.signInWithEmailAndPassword(email, password);
  }

  async function signOut() {
    if (start() && auth.currentUser) await auth.signOut();
  }

  async function loadWorks() {
    if (!start()) return [];
    try {
      const snapshot = await db.collection('galleryWorks').get();
      const works = snapshot.docs.map(doc => normaliseWork(doc.data())).filter(work => work.code);
      console.info('[Mahadev Gallery] Firestore works loaded:', works.length);
      return works;
    } catch (error) {
      console.error('[Mahadev Gallery] Firestore read failed', {
        code: error.code || null,
        message: error.message
      });
      throw error;
    }
  }

  async function nextArtworkCode() {
    const snapshot = await db.collection('galleryWorks').get();
    let highest = 0;
    snapshot.forEach(doc => {
      const match = String(doc.id || '').match(/^ADM\.(\d+)$/);
      if (match) highest = Math.max(highest, Number(match[1]));
    });
    return `ADM.${String(highest + 1).padStart(3, '0')}`;
  }

  async function uploadArtwork(work, file) {
    await requireAdmin();
    if (!file || !/\.(jpe?g)$/i.test(file.name) || (file.type && !/^image\/(jpeg|jpg)$/.test(file.type))) {
      throw new Error('Only JPG and JPEG images are accepted.');
    }
    const code = work.code || await nextArtworkCode();
    if (file.size > CLOUDINARY_MAX_FILE_SIZE) {
      throw new Error('Please choose an image smaller than 10 MB.');
    }
    const formData = new FormData();
    const uploadSource = work.img && work.img.startsWith('data:')
      ? await fetch(work.img).then(source => source.blob())
      : file;
    formData.append('file', uploadSource);
    formData.append('upload_preset', CLOUDINARY_UPLOAD_PRESET);
    console.log('Cloudinary endpoint:', CLOUDINARY_UPLOAD_URL);
    console.log('Cloudinary preset:', CLOUDINARY_UPLOAD_PRESET);
    console.log('Upload fields:', [...formData.keys()]);
    const response = await fetch(CLOUDINARY_UPLOAD_URL, {
      method: 'POST',
      body: formData
    });
    console.log('Cloudinary HTTP status:', response.status);
    let result;
    try {
      result = await response.json();
    } catch (error) {
      throw new Error(`Cloudinary upload failed (HTTP ${response.status}): invalid JSON response.`);
    }
    if (!response.ok || !result.secure_url) {
      const cloudinaryError = result.error || {};
      const errorCode = cloudinaryError.code || response.status;
      const errorMessage = cloudinaryError.message || 'Cloudinary upload failed.';
      console.error('[Cloudinary] upload failed', {
        code: errorCode,
        message: errorMessage
      });
      throw new Error(`Cloudinary upload failed (${errorCode}): ${errorMessage}`);
    }
    const record = {
      code,
      title: work.title || 'Untitled Piece',
      album: work.album || 'Unsorted',
      category: work.category || work.cat || 'mural',
      description: work.description || work.meta || '',
      imageUrl: result.secure_url,
      ...(result.public_id ? { cloudinaryPublicId: result.public_id } : {}),
      ...(result.asset_id ? { cloudinaryAssetId: result.asset_id } : {}),
      hero: work.hero === true,
      uploadedAt: firebase.firestore.FieldValue.serverTimestamp()
    };
    try {
      const user = auth.currentUser;
      const tokenResult = user ? await user.getIdTokenResult() : null;
      console.info('[Mahadev Firestore] writing galleryWorks', {
        uid: user ? user.uid : null,
        email: user ? user.email : null,
        signInProvider: tokenResult && tokenResult.claims.firebase
          ? tokenResult.claims.firebase.sign_in_provider
          : null,
        code,
        collection: 'galleryWorks'
      });
      await db.collection('galleryWorks').doc(code).set(record);
    } catch (error) {
      const user = auth.currentUser;
      console.error('[Mahadev Firestore] galleryWorks write failed', {
        uid: user ? user.uid : null,
        email: user ? user.email : null,
        code: error.code || null,
        message: error.message
      });
      throw new Error(`Artwork metadata could not be saved to Firestore: ${error.message}`);
    }
    return normaliseWork({ ...record, uploadedAt: new Date().toISOString() });
  }

  async function updateArtwork(code, changes) {
    await requireAdmin();
    await db.collection('galleryWorks').doc(code).update(changes);
  }

  async function deleteArtwork(work) {
    await requireAdmin();
    // Permanent Cloudinary deletion requires a secure server-side operation.
    await db.collection('galleryWorks').doc(work.code).delete();
  }

  async function createInquiry(values) {
    if (!start()) throw new Error('Firebase configuration is missing.');
    const reference = db.collection('inquiries').doc();
    const record = {
      inquiryId: reference.id,
      name: values.name,
      ...(values.email ? { email: values.email } : {}),
      ...(values.phone ? { phone: values.phone } : {}),
      projectType: values.projectType,
      budget: values.budget,
      ...(values.message ? { message: values.message } : {}),
      createdAt: firebase.firestore.FieldValue.serverTimestamp(),
      status: 'new'
    };
    await reference.set(record);
    return record;
  }

  async function listInquiries() {
    await requireAdmin();
    const snapshot = await db.collection('inquiries').orderBy('createdAt', 'desc').get();
    return snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
  }

  async function updateInquiry(id, status) {
    await requireAdmin();
    await db.collection('inquiries').doc(id).update({ status });
  }

  async function deleteInquiry(id) {
    await requireAdmin();
    await db.collection('inquiries').doc(id).delete();
  }

  api.start = start;
  api.initialize = function () {
    if (!start()) return null;
    console.log('Firebase initialized:', !!firebase.app());
    console.log('Firebase Auth initialized:', !!auth);
    console.log('Current user:', auth.currentUser);
    return { app, auth, db };
  };
  api.signIn = signIn;
  api.signOut = signOut;
  api.loadWorks = loadWorks;
  api.uploadArtwork = uploadArtwork;
  api.updateArtwork = updateArtwork;
  api.deleteArtwork = deleteArtwork;
  api.createInquiry = createInquiry;
  api.listInquiries = listInquiries;
  api.updateInquiry = updateInquiry;
  api.deleteInquiry = deleteInquiry;
  window.MahadevFirebase = api;
})();
