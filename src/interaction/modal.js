// Modal dialog
export function showModal(options) {
  const prevFocus = document.activeElement;

  const backdrop = document.createElement('div');
  backdrop.className = 'vim-modal-backdrop';

  const form = document.createElement('form');
  form.className = 'vim-modal';

  const heading = document.createElement('div');
  heading.className = 'vim-modal-title';
  heading.innerText = options.title;
  form.appendChild(heading);

  const inputs = [];
  for (let i = 0; i < options.fields.length; i++) {
    const field = options.fields[i];
    const label = document.createElement('label');
    label.className = 'vim-modal-field';
    const p = document.createElement('p');
    p.innerText = field.label;
    const input = document.createElement('input');
    input.type = 'text';
    input.placeholder = field.placeholder || '';
    input.value = field.value || '';
    label.appendChild(p);
    label.appendChild(input);
    form.appendChild(label);
    inputs.push(input);
  }

  const buttons = document.createElement('div');
  buttons.className = 'vim-modal-buttons';
  const cancel = document.createElement('button');
  cancel.type = 'button';
  cancel.innerText = 'Cancel';
  cancel.onclick = close;
  const submit = document.createElement('button');
  submit.type = 'submit';
  submit.innerText = options.submitLabel || 'Submit';
  buttons.appendChild(cancel);
  buttons.appendChild(submit);
  form.appendChild(buttons);

  function close() {
    if (backdrop.parentNode) backdrop.parentNode.removeChild(backdrop);
    document.removeEventListener('keydown', onKeyDown, true);
    if (prevFocus && prevFocus.isConnected && prevFocus.focus) prevFocus.focus();
  }

  function onKeyDown(event) {
    if (event.key === 'Escape') {
      event.stopPropagation();
      close();
    }
  }

  form.onsubmit = (event) => {
    event.preventDefault();
    const values = inputs.map(input => input.value.trim());
    if (!options.onSubmit(values)) return;
    close();
  };

  backdrop.onmousedown = (event) => {
    if (event.target === backdrop) close();
    return false;
  };

  document.addEventListener('keydown', onKeyDown, true);
  backdrop.appendChild(form);
  document.body.appendChild(backdrop);
  if (inputs.length > 0) inputs[0].focus();
  else cancel.focus();
}
