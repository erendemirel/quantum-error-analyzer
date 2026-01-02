// Non-blocking notification system
let notificationTimeout = null;

export function showNotification(message, duration = 3000, type = 'error') {
    // Remove any existing notification
    const existing = document.getElementById('user-notification');
    if (existing) {
        existing.remove();
    }
    
    // Clear any pending timeout
    if (notificationTimeout) {
        clearTimeout(notificationTimeout);
        notificationTimeout = null;
    }
    
    // Determine background color based on type
    const backgroundColor = type === 'success' ? '#27ae60' : '#e74c3c';
    
    // Create notification element
    const notification = document.createElement('div');
    notification.id = 'user-notification';
    notification.style.cssText = `
        position: fixed;
        top: 20px;
        right: 20px;
        background: ${backgroundColor};
        color: white;
        padding: 12px 20px;
        border-radius: 6px;
        box-shadow: 0 4px 12px rgba(0, 0, 0, 0.3);
        z-index: 10000;
        font-size: 0.9rem;
        max-width: 400px;
        line-height: 1.5;
        animation: slideIn 0.3s ease-out;
    `;
    notification.textContent = message;
    
    // Add animation keyframes if not already present
    if (!document.getElementById('notification-styles')) {
        const style = document.createElement('style');
        style.id = 'notification-styles';
        style.textContent = `
            @keyframes slideIn {
                from {
                    transform: translateX(100%);
                    opacity: 0;
                }
                to {
                    transform: translateX(0);
                    opacity: 1;
                }
            }
            @keyframes slideOut {
                from {
                    transform: translateX(0);
                    opacity: 1;
                }
                to {
                    transform: translateX(100%);
                    opacity: 0;
                }
            }
        `;
        document.head.appendChild(style);
    }
    
    document.body.appendChild(notification);
    
    // Auto-remove after duration
    notificationTimeout = setTimeout(() => {
        notification.style.animation = 'slideOut 0.3s ease-out';
        setTimeout(() => {
            if (notification.parentNode) {
                notification.remove();
            }
        }, 300);
    }, duration);
    
    return notification;
}

export function clearNotification() {
    const existing = document.getElementById('user-notification');
    if (existing) {
        existing.style.animation = 'slideOut 0.3s ease-out';
        setTimeout(() => {
            if (existing.parentNode) {
                existing.remove();
            }
        }, 300);
    }
    
    // Clear any pending timeout
    if (notificationTimeout) {
        clearTimeout(notificationTimeout);
        notificationTimeout = null;
    }
}

