// ==UserScript==
// @name         HLTB+
// @namespace    http://tampermonkey.net/
// @version      2026-04-20
// @description  QoL improvements for HLTB
// @author       RunePML
// @match        https://howlongtobeat.com/*
// @icon         https://www.google.com/s2/favicons?sz=64&domain=howlongtobeat.com
// @grant        none
// ==/UserScript==

(function() {
    'use strict';

    let currentPage = [];

    setTimeout(() => {
        console.log('HLTB+ is running');

        initNavigationObserver();
        onNavigate();
    }, 1000);

    function findCurrentPage() {
        currentPage = window.location.pathname.substring(1).split('/');
    }

    function waitForElement(selector, callback, maxAttempts = -1) {
        let attempts = 0;
        let waitInterval = setInterval(() => {
            let element = document.querySelector(selector);
            if (element) {
                clearInterval(waitInterval);
                callback(element);
                return;
            } else if (maxAttempts !== -1) {
                attempts++;
                if (attempts > maxAttempts) {
                    console.error('Element not found', selector);
                    clearInterval(waitInterval);
                }
            }
        }, 100);
    }

    function initNavigationObserver() {
        setInterval(() => {
            const prevPage = JSON.stringify(currentPage);
            findCurrentPage();

            if (prevPage !== JSON.stringify(currentPage)) {
                console.log('Navigated from', prevPage, 'to', JSON.stringify(currentPage));
                onNavigate();
            }
        }, 1000);
    }

    function onNavigate() {
        switch(currentPage[0]) {
            case 'submit':
                if (currentPage[1] && currentPage[1] === 'edit') {
                    editGamePage();
                }
                break;
            default:
                // Do nothing
                break;
        }
    }

    function editGamePage() {
        waitForElement('.in.back_secondary.shadow_box.mobile_hide', (progressTimer) => {
            progressTimer.classList.remove('mobile_hide');
        }, 20);
    }
})();
