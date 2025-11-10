// usb_warning.js

let serialModalShown = false;

/**
 * Loads the USB warning modal HTML and injects it into the body.
 */
async function loadUsbWarningModal() {
    try {
        const response = await fetch('usb_warning.html');
        if (!response.ok) {
            throw new Error(`HTTP error! status: ${response.status}`);
        }
        const html = await response.text();
        document.body.insertAdjacentHTML('beforeend', html);
        console.log('USB warning modal loaded and injected successfully.');
    } catch (e) {
        console.error('Failed to load USB warning modal:', e);
    }
}

/**
 * Handles serial connection status updates, showing or hiding the USB warning modal.
 * @param {object} payload - The serial status payload from the worker.
 */
function handleSerialStatusUpdate(payload) {
    const { connected, error, port, baudrate } = payload;

    // Update balança status in footer (assuming it exists in the main page)
    const balancaStatus = document.getElementById('balanca-status');
    if (balancaStatus) {
        if (connected) {
            balancaStatus.textContent = `Conectado (${port || 'USB'})`;
            balancaStatus.style.color = 'var(--cor-sucesso)';
        } else {
            balancaStatus.textContent = 'Desconectado';
            balancaStatus.style.color = 'var(--cor-alerta)';
        }
    }

    // Show/hide modal based on connection status
    const modal = document.getElementById('modal-serial-warning');
    const errorMessage = document.getElementById('serial-error-message');
    const reconnectStatus = document.getElementById('serial-reconnect-status');

    if (!modal) {
        console.warn('USB warning modal element not found.');
        return;
    }

    if (!connected && (error || true)) {
        // Show error modal
        if (errorMessage) {
            errorMessage.textContent = error;
        }
        if (reconnectStatus) {
            reconnectStatus.textContent = 'Tentando reconectar automaticamente...';
        }
        if (!serialModalShown) {
            modal.style.display = 'block';
            modal.style.zIndex = '99999'; // Force to top layer
            modal.style.position = 'fixed'; // Ensure it's fixed
            modal.style.top = '0';
            modal.style.left = '0';
            modal.style.width = '100%';
            modal.style.height = '100%';
            modal.style.backgroundColor = 'rgba(0, 0, 0, 0.7)'; // Ensure background is visible
            serialModalShown = true;
        }
    } else if (connected) {
        // Hide modal and show success notification
        if (serialModalShown) {
            modal.style.display = 'none';
            serialModalShown = false;
            // Assuming showNotification function exists in the main script
            if (typeof showNotification === 'function') {
                showNotification('success', `✓ Conectado à balança via ${port || 'USB'}`);
            }
        }
    }
}

/**
 * Closes the serial warning modal.
 */
function fecharModalSerial() {
    const modal = document.getElementById('modal-serial-warning');
    if (modal) {
        modal.style.display = 'none';
        serialModalShown = false;
    }
}

// Load the modal when the DOM is fully loaded
document.addEventListener('DOMContentLoaded', loadUsbWarningModal);
