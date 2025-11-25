'use client';

import { useEffect } from 'react';

/**
 * Syncs dark mode class from Whop's HTML to our app
 * Whop automatically adds 'dark' class to HTML based on user preference
 */
export default function DarkModeSync() {
  useEffect(() => {
    // Check if dark class exists on html element (set by Whop)
    const htmlElement = document.documentElement;
    const isDark = htmlElement.classList.contains('dark');
    
    // Sync the class
    if (isDark) {
      htmlElement.classList.add('dark');
    } else {
      htmlElement.classList.remove('dark');
      htmlElement.classList.add('light');
    }

    // Watch for changes (in case Whop updates it dynamically)
    const observer = new MutationObserver((mutations) => {
      mutations.forEach((mutation) => {
        if (mutation.type === 'attributes' && mutation.attributeName === 'class') {
          const isCurrentlyDark = htmlElement.classList.contains('dark');
          if (isCurrentlyDark) {
            htmlElement.classList.remove('light');
            htmlElement.classList.add('dark');
          } else {
            htmlElement.classList.remove('dark');
            htmlElement.classList.add('light');
          }
        }
      });
    });

    observer.observe(htmlElement, {
      attributes: true,
      attributeFilter: ['class'],
    });

    return () => observer.disconnect();
  }, []);

  return null;
}

