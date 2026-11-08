import { gsap } from 'gsap';
import { isMobile, prefersReducedMotion } from '@/services/device';

/** Wraps each word of an element's text in a span, keeping inline markup, so the words can animate in turn. */
const splitWords = (element: HTMLElement) => {
    const walker = document.createTreeWalker(element, NodeFilter.SHOW_TEXT);
    const textNodes: Text[] = [];
    while (walker.nextNode()) textNodes.push(walker.currentNode as Text);

    textNodes.forEach(node => {
        const fragment = document.createDocumentFragment();
        // Ordinary whitespace only, so words joined by &nbsp; stay together
        node.data.split(/([ \t\n]+)/).forEach(part => {
            if (!part) return;
            if (/^[ \t\n]+$/.test(part)) {
                fragment.append(part);
                return;
            }
            const word = document.createElement('span');
            word.className = 'word';
            word.textContent = part;
            fragment.append(word);
        });
        node.replaceWith(fragment);
    });

    return element.querySelectorAll<HTMLElement>('.word');
};

/**
 * A caption that plays in word by word when shown. The animation runs in time rather than
 * being scrubbed, so the caption always finishes revealing however quickly it was scrolled to.
 * The element must not be re-rendered by Vue afterwards (render it with `v-once`).
 */
export const createCaption = (element: HTMLElement) => {
    const words = prefersReducedMotion ? [] : splitWords(element);
    // Blurring each word is the nicest entrance, but too much per-frame work for phones
    const blur = isMobile ? {} : { filter: 'blur(8px)' };
    let isShown = false;

    return {
        show() {
            if (isShown) return;
            isShown = true;

            if (prefersReducedMotion) {
                gsap.to(element, { autoAlpha: 1, duration: 0.3, overwrite: true });
                return;
            }
            gsap.killTweensOf(element);
            gsap.set(element, { autoAlpha: 1, y: 0 });
            gsap.fromTo(words,
                { autoAlpha: 0, y: '0.45em', ...blur },
                {
                    autoAlpha: 1,
                    y: 0,
                    ...(isMobile ? {} : { filter: 'blur(0px)', clearProps: 'filter' }),
                    duration: 0.9,
                    stagger: 0.035,
                    ease: 'power3.out',
                    overwrite: true,
                });
        },
        hide() {
            if (!isShown) return;
            isShown = false;
            gsap.to(element, {
                autoAlpha: 0,
                y: prefersReducedMotion ? 0 : -16,
                duration: prefersReducedMotion ? 0.3 : 0.45,
                ease: 'power2.in',
                overwrite: true,
            });
        },
    };
};
