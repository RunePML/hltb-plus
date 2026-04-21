// ==UserScript==
// @name         HLTB+
// @namespace    http://tampermonkey.net/
// @version      0.5
// @description  QoL improvements for HLTB
// @author       RunePML
// @match        https://howlongtobeat.com/*
// @icon         https://www.google.com/s2/favicons?sz=64&domain=howlongtobeat.com
// @grant        none
// ==/UserScript==

(function () {
    'use strict';

    const ID_PREFIX = 'HLTBP_';

    let currentPage = [];
    let timerRunning = false;

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

        // Guard to avoid losing progress on a running timer when reloading or closing the tab
        window.addEventListener('beforeunload', (event) => {
            if (timerRunning) {
                event.preventDefault();
                event.returnValue = '';
            }
        });
    }

    function onNavigate() {
        switch (currentPage[0]) {
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
            customizeProgressTimer(progressTimer);
        }, 20);
    }

    function customizeProgressTimer(progressTimer) {
        // Custom classes
        progressTimer.classList.remove('mobile_hide');

        // Custom events
        let timerInterval = null;

        const pageTitle = document.querySelector('title');
        const pageTitleText = pageTitle.innerText;

        const progressText = progressTimer.querySelector('.form_text.back_dark.center');

        const startBtn = progressTimer.querySelector('.form_button.back_red');
        startBtn.addEventListener('click', () => {
            if (!timerInterval) {
                timerInterval = setInterval(() => {
                    pageTitle.innerText = progressText.innerText + ' | ' + pageTitleText;
                    timerRunning = true;
                }, 500);
                console.log('Timer running');
            }
        });

        const onTimerStop = () => {
            clearInterval(timerInterval);
            pageTitle.innerText = pageTitleText;
            timerRunning = false;
            console.log('Timer stopped');
        };
        const addBtn = progressTimer.querySelector('.form_button.form_blue.primary');
        addBtn.addEventListener('click', onTimerStop);
        const resetBtn = progressTimer.querySelector('.form_button.form_blue.secondary');
        resetBtn.addEventListener('click', onTimerStop);
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

            const fieldsBtn = document.createElement('button');
            fieldsBtn.id = ID_PREFIX + 'fields_btn';
            fieldsBtn.type = 'button';
            resetFiltersBtn.classList.forEach(cssClass => fieldsBtn.classList.add(cssClass));
            fieldsBtn.classList.add('back_green');
            fieldsBtn.innerText = 'v';
            fieldsBtn.addEventListener('click', toggleExportFields);
            buttonsContainer.appendChild(fieldsBtn);

            const fields = document.createElement('div');
            fields.id = ID_PREFIX + 'fields';
            fields.style = 'position: absolute; z-index: 1; right: 24px; padding: 20px; display: flex; flex-direction: column; align-items: end; display: none;';
            fields.classList.add('back_green', 'shadow_box');
            buttonsContainer.appendChild(fields);

            ['Game', 'Platform', 'Progress', 'Rating'].forEach(label => {
                const fieldCb = document.createElement('input');
                fieldCb.id = ID_PREFIX + 'field_' + label.toLocaleLowerCase();
                fieldCb.name = fieldCb.id;
                fieldCb.type = 'checkbox';
                fieldCb.checked = true;

                const fieldLabel = document.createElement('label');
                fieldLabel.for = fieldCb.id;
                fieldLabel.innerText = label;
                fieldLabel.appendChild(fieldCb);
                fields.appendChild(fieldLabel);
            });
        }, 20);
    }

    function exportGamesList() {
        waitForElement('select[aria-label="View Options"]', viewOptions => {
            viewOptions.value = 'list';
            viewOptions.dispatchEvent(new Event('change', { bubbles: true }));

            waitForElement('#user_games .in > div', gamesList => {
                const fieldGame = document.querySelector('#' + ID_PREFIX + 'field_game').checked;
                const fieldPlatform = document.querySelector('#' + ID_PREFIX + 'field_platform').checked;
                const fieldProgress = document.querySelector('#' + ID_PREFIX + 'field_progress').checked;
                const fieldRating = document.querySelector('#' + ID_PREFIX + 'field_rating').checked;

                let csv = '';
                if (fieldGame) {
                    csv += 'Game;'
                }
                if (fieldPlatform) {
                    csv += 'Platform;'
                }
                if (fieldProgress) {
                    csv += 'Progress'
                }
                if (fieldRating) {
                    csv += 'Rating;'
                }
                csv += '\n';


                const rows = gamesList.querySelectorAll('.spreadsheet > div');

                rows.forEach(row => {
                    const columns = row.querySelectorAll('div');

                    if (fieldGame) {
                        csv += columns[0].querySelector('a').innerText + ';'
                    }
                    if (fieldPlatform) {
                        csv += columns[0].querySelector('span').innerText + ';'
                    }
                    if (fieldProgress) {
                        csv += columns[1].innerText + ';'
                    }
                    if (fieldRating) {
                        csv += columns[2].innerText + ';'
                    }

                    csv += '\n';
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

    function toggleExportFields() {
        const fieldsBtn = document.querySelector('#' + ID_PREFIX + 'fields_btn');
        const fields = document.querySelector('#' + ID_PREFIX + 'fields');
        if (fields.style.display === 'none') {
            fieldsBtn.innerText = '^';
            fields.style.display = 'flex';
        } else {
            fields.style.display = 'none';
            fieldsBtn.innerText = 'v';
        }
    }
})();
