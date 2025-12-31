// frontend/src/utils/FocusFix.js
import { useEffect } from 'react';

export const useFocusFix = () => {
  useEffect(() => {
    // ✅ Prevent lag by ensuring immediate input response
    const handleInputFocus = (e) => {
      const target = e.target;
      
      if (target && (target.tagName === 'INPUT' || 
                      target.tagName === 'TEXTAREA' || 
                      target.tagName === 'SELECT')) {
        
        // Force immediate focus
        target.style.userSelect = 'text';
        target.style.cursor = 'text';
        target.style.pointerEvents = 'auto';
        
        // Ensure it stays focused
        requestAnimationFrame(() => {
          if (document.activeElement !== target) {
            target.focus();
          }
        });
      }
    };

    // ✅ Fix click lag
    const handleClick = (e) => {
      const target = e.target;
      if (target && target.tagName === 'BUTTON') {
        target.style.pointerEvents = 'auto';
        target.style.cursor = 'pointer';
      }
    };

    // ✅ Handle window focus/blur
    const handleWindowFocus = () => {
      requestAnimationFrame(() => {
        const inputs = document.querySelectorAll('input, textarea, select');
        inputs.forEach(input => {
          input.style.userSelect = 'text';
          input.style.cursor = 'text';
          input.style.pointerEvents = 'auto';
        });
        
        const buttons = document.querySelectorAll('button');
        buttons.forEach(button => {
          button.style.pointerEvents = 'auto';
          button.style.cursor = 'pointer';
        });
      });
    };

    const handleWindowBlur = () => {
      // Don't throttle on blur
    };

    // Add event listeners
    document.addEventListener('focusin', handleInputFocus, true);
    document.addEventListener('click', handleClick, true);
    window.addEventListener('focus', handleWindowFocus);
    window.addEventListener('blur', handleWindowBlur);
    
    // Initial fix
    handleWindowFocus();

    // Periodic check for new elements
    const intervalId = setInterval(handleWindowFocus, 1000);

    return () => {
      document.removeEventListener('focusin', handleInputFocus, true);
      document.removeEventListener('click', handleClick, true);
      window.removeEventListener('focus', handleWindowFocus);
      window.removeEventListener('blur', handleWindowBlur);
      clearInterval(intervalId);
    };
  }, []);
};

export default function FocusFix({ children }) {
  useFocusFix();
  return children;
}