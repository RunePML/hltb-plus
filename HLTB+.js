// ==UserScript==
// @name         HLTB+
// @namespace    http://tampermonkey.net/
// @version      2026-04-21
// @description  QoL improvements for HLTB
// @author       RunePML
// @match        https://howlongtobeat.com/*
// @icon         https://www.google.com/s2/favicons?sz=64&domain=howlongtobeat.com
// @grant        none
// ==/UserScript==

(function() {
    'use strict';

    const ID_PREFIX = 'HLTBP_';

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
                    editPage();
                }
                break;
            case 'user':
                if (currentPage[2] && currentPage[2] === 'games') {
                    gamesPage();
                }
                break
            default:
                // Do nothing
                break;
        }
    }

    function editPage() {
        waitForElement('.in.back_secondary.shadow_box.mobile_hide', progressTimer => {
            progressTimer.classList.remove('mobile_hide');
        }, 20);
    }

    function gamesPage() {
        waitForElement('.form_button.back_red', resetFiltersBtn => {
            if (document.querySelector('#' + ID_PREFIX + 'export_btn')) {
                return;
            }

            const buttonsContainer = resetFiltersBtn.parentElement;

            const exportBtn = document.createElement('button');
            exportBtn.id = ID_PREFIX + 'export_btn';
            exportBtn.type = 'button';
            resetFiltersBtn.classList.forEach(cssClass => exportBtn.classList.add(cssClass));
            exportBtn.classList.add('back_green');
            exportBtn.innerText = 'Export list';
            exportBtn.addEventListener('click', exportGamesList);
            buttonsContainer.appendChild(exportBtn);
        }, 20);
    }

    function exportGamesList() {
        waitForElement('select[aria-label="View Options"]', viewOptions => {
            viewOptions.value = 'list';
            viewOptions.dispatchEvent(new Event('change', { bubbles: true }));

            waitForElement('#user_games .in > div', gamesList => {
                let csv = 'Game;Platform;Progress;Rating\n';
                const rows = gamesList.querySelectorAll('.spreadsheet > div');

                rows.forEach(row => {
                    const columns = row.querySelectorAll('div');
                    const game = columns[0].querySelector('a').innerText;
                    csv += game + ';'
                    const platform = columns[0].querySelector('span').innerText;
                    csv += platform + ';'
                    const progress = columns[1].innerText;
                    csv += progress + ';'
                    const rating = columns[2].innerText;
                    csv += rating + '\n'
                });

                const blob = new Blob([csv], { type: "text/csv" });
                const url = URL.createObjectURL(blob);

                const link = document.createElement("a");
                link.href = url;
                link.download = 'games-' + currentPage[3] + '.csv';
                link.click();

                URL.revokeObjectURL(url);
            }, 20);
        }, 20);
    }
})();
