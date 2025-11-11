// notification.js

/**
 * Displays a notification message on the screen.
 * @param {string} type - The type of notification ('success', 'error', 'warning', 'info').
 * @param {string} message - The message to display.
 * @param {number} [duration=5000] - How long the notification should be displayed in milliseconds.
 */
function showNotification(type, message, duration = 5000) {
    const notification = document.createElement('div');
    notification.style.cssText = `
        position: fixed;
        top: 100px;
        right: 20px;
        padding: 1rem 1.5rem;
        border-radius: 8px;
        color: white;
        font-family: sans-serif;
        z-index: 10000;
        opacity: 0.4;
        transition: opacity 0.5s, transform 0.5s;
        transform: translateX(100%);
    `;
    notification.style.backgroundColor = type === 'error' ? '#e74c3c' : (type === 'success' ? '#2ecc71' : (type === 'warning' ? '#f39c12' : '#3498db'));
    notification.innerHTML = message;
    document.body.appendChild(notification);

    setTimeout(() => {
        notification.style.opacity = '1';
        notification.style.transform = 'translateX(0)';
    }, 10);

    setTimeout(() => {
        notification.style.opacity = '0';
        notification.style.transform = 'translateX(100%)';
        setTimeout(() => notification.remove(), 500);
    }, duration);
}
