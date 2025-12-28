document.addEventListener('DOMContentLoaded', () => {
  const configEl = document.getElementById('variables-config');
  if (!configEl) return;

  const variables = JSON.parse(configEl.textContent);
  const storageKey = `variables:${window.location.pathname}`;

  // Elements
  const modal = document.getElementById('var-modal');
  const openBtn = document.getElementById('customize-vars-btn');
  const closeBtn = document.getElementById('modal-close');
  const cancelBtn = document.getElementById('modal-cancel');
  const saveBtn = document.getElementById('modal-save');
  const resetBtn = document.getElementById('modal-reset');
  const form = document.getElementById('var-form');
  const proseContent = document.getElementById('prose-content');

  // Load saved values
  function getSavedValues() {
    try {
      return JSON.parse(localStorage.getItem(storageKey)) || {};
    } catch {
      return {};
    }
  }

  // Save values to localStorage
  function saveValues(values) {
    localStorage.setItem(storageKey, JSON.stringify(values));
  }

  // Clear saved values
  function clearValues() {
    localStorage.removeItem(storageKey);
  }

  // Get form values
  function getFormValues() {
    const values = {};
    variables.forEach(v => {
      const input = document.getElementById(`var-${v.name}`);
      if (input && input.value.trim()) {
        values[v.name] = input.value.trim();
      }
    });
    return values;
  }

  // Populate form with saved values
  function populateForm() {
    const saved = getSavedValues();
    variables.forEach(v => {
      const input = document.getElementById(`var-${v.name}`);
      if (input) {
        input.value = saved[v.name] || '';
      }
    });
  }

  // Apply substitutions to content
  function applySubstitutions() {
    const saved = getSavedValues();
    if (Object.keys(saved).length === 0) return;

    // Walk all text nodes in prose content
    const walker = document.createTreeWalker(
      proseContent,
      NodeFilter.SHOW_TEXT,
      null,
      false
    );

    const textNodes = [];
    let node;
    while (node = walker.nextNode()) {
      textNodes.push(node);
    }

    textNodes.forEach(textNode => {
      let text = textNode.textContent;
      let hasMatch = false;

      // Check each variable
      Object.entries(saved).forEach(([name, value]) => {
        const pattern = new RegExp(`\\$${name}\\b`, 'g');
        if (pattern.test(text)) {
          hasMatch = true;
          text = text.replace(pattern, `\u0000${name}\u0001${value}\u0002`);
        }
      });

      if (hasMatch) {
        // Create fragment with highlighted substitutions
        const fragment = document.createDocumentFragment();
        const parts = text.split(/\u0000|\u0002/);

        parts.forEach(part => {
          if (part.includes('\u0001')) {
            const [name, value] = part.split('\u0001');
            const span = document.createElement('span');
            span.className = 'var-substituted';
            span.setAttribute('data-var', name);
            span.textContent = value;
            fragment.appendChild(span);
          } else if (part) {
            fragment.appendChild(document.createTextNode(part));
          }
        });

        textNode.parentNode.replaceChild(fragment, textNode);
      }
    });
  }

  // Modal handlers
  function openModal() {
    populateForm();
    modal.classList.remove('hidden');
    document.body.style.overflow = 'hidden';
  }

  function closeModal() {
    modal.classList.add('hidden');
    document.body.style.overflow = '';
  }

  function handleSave() {
    const values = getFormValues();
    saveValues(values);
    closeModal();
    // Reload to apply fresh substitutions
    window.location.reload();
  }

  function handleReset() {
    clearValues();
    closeModal();
    window.location.reload();
  }

  // Event listeners
  openBtn.addEventListener('click', openModal);
  closeBtn.addEventListener('click', closeModal);
  cancelBtn.addEventListener('click', closeModal);
  saveBtn.addEventListener('click', handleSave);
  resetBtn.addEventListener('click', handleReset);

  // Close on overlay click
  modal.addEventListener('click', (e) => {
    if (e.target === modal) closeModal();
  });

  // Close on Escape key
  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape' && !modal.classList.contains('hidden')) {
      closeModal();
    }
  });

  // Apply substitutions on page load
  applySubstitutions();
});
