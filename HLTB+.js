// ==UserScript==
// @name         HLTB+
// @namespace    http://tampermonkey.net/
// @version      0.7
// @description  QoL improvements for HLTB
// @author       RunePML
// @match        https://howlongtobeat.com/*
// @icon         https://www.google.com/s2/favicons?sz=64&domain=howlongtobeat.com
// @grant        none
// ==/UserScript==

(function () {
    'use strict';

    const ID_PREFIX = 'HLTBP_';
    const editPage = {
        progressTimer: {
            timerRunning: false,
            timerPaused: false
        },
        currentProgress: 0
    };

    let options = {
        journalEnabled: false,
    };

    let notificationsContainer = null;
    let currentPage = [];

    setTimeout(() => {
        console.log('HLTB+ is running');
        loadOptions();
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

    function loadOptions() {
        const loadedOptions = localStorage.getItem(ID_PREFIX + 'options');
        if (!loadedOptions)
            return;

        options = JSON.parse(loadedOptions);
        console.log('Loaded options:', options);
    }

    function saveOptions() {
        localStorage.setItem(ID_PREFIX + 'options', JSON.stringify(options));
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
            if (editPage.progressTimer.timerRunning) {
                event.preventDefault();
                event.returnValue = '';
            }
        });
    }

    function onNavigate() {
        setMainBackgroundColor('transparent');

        switch (currentPage[0]) {
            case 'submit':
                if (currentPage[1] && currentPage[1] === 'edit') {
                    onEditPage();
                }
                break;
            case 'user':
                onUserPage();

                if (currentPage[2] && currentPage[2] === 'games') {
                    onGamesPage();
                } else if (currentPage[2] && currentPage[2] === 'options') {
                    onOptionsPage();
                }
                break
            default:
                // Do nothing
                break;
        }
    }

    function onEditPage() {
        waitForElement('.in.back_secondary.shadow_box.mobile_hide', progressTimer => {
            customizeProgressTimer(progressTimer);
        }, 20);

        waitForElement('#progress_jump', currentProgressElement => {
            customizeCurrentProgress(currentProgressElement);
        });
    }

    function onUserPage() {
        waitForElement('[class^="UserNavigation-module"]', navigationElement => {
            if (options.journalEnabled)
                addJournalTab(navigationElement);
        });
    }

    function onGamesPage() {
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

    function onOptionsPage() {
        waitForElement('.contain_out:last-of-type .contain_in', optionsContainer => {
            const optionsColumns = optionsContainer.querySelectorAll('.content_33');
            createOptionsPanel(optionsColumns[optionsColumns.length - 1]);
        });
    }

    function setMainBackgroundColor(color) {
        const pageMain = document.querySelector('main');
        if (pageMain) {
            pageMain.style.backgroundColor = color;
        }
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
                editPage.progressTimer.timerPaused = false;
                timerInterval = setInterval(() => {
                    pageTitle.innerText = progressText.innerText + ' | ' + pageTitleText;
                    editPage.progressTimer.timerRunning = true;

                    if (editPage.progressTimer.timerPaused) {
                        setMainBackgroundColor('rgba(203, 58, 59, 0.6)');
                    } else {
                        setMainBackgroundColor('rgba(61, 169, 73, 0.6)');
                    }
                }, 500);
                console.log('Timer running');
            } else {
                editPage.progressTimer.timerPaused = !editPage.progressTimer.timerPaused;
                console.log('Timer ' + (editPage.progressTimer.timerPaused ? 'paused' : 'running'));
            }
        });

        const onTimerStop = () => {
            clearInterval(timerInterval);
            timerInterval = null;
            pageTitle.innerText = pageTitleText;
            editPage.progressTimer.timerRunning = false;
            editPage.progressTimer.timerPaused = false;
            setMainBackgroundColor('transparent');
            console.log('Timer stopped');
        };
        const addBtn = progressTimer.querySelector('.form_button.form_blue.primary');
        addBtn.addEventListener('click', onTimerStop);
        const resetBtn = progressTimer.querySelector('.form_button.form_blue.secondary');
        resetBtn.addEventListener('click', onTimerStop);
    }

    function getCurrentProgressInSeconds(currentProgressElement) {
        const inputs = currentProgressElement.querySelectorAll('input');
        const hours = inputs[0].value !== '' ? Number.parseInt(inputs[0].value) : 0;
        const minutes = inputs[1].value !== '' ? Number.parseInt(inputs[1].value) : 0;
        const seconds = inputs[2].value !== '' ? Number.parseInt(inputs[2].value) : 0;
        return (hours * 3600) + (minutes * 60) + seconds;
    }

    function customizeCurrentProgress(currentProgressElement) {
        editPage.currentProgress = getCurrentProgressInSeconds(currentProgressElement);
        console.log('Current progress in seconds: ', editPage.currentProgress);

        const saveBtn = document.querySelector('.global_padding_big.form_blue');
        saveBtn.addEventListener('click', () => {
            const savedProgress = getCurrentProgressInSeconds(currentProgressElement);
            const totalSeconds = savedProgress - editPage.currentProgress;
            const hours = Math.floor(totalSeconds / 3600);
            const minutes = Math.floor((totalSeconds % 3600) / 60);
            const seconds = totalSeconds % 60;
            const gameTitle = document.querySelector('h1').innerText;
            showNotification('Game: ' + gameTitle + ' - Session duration: ' + hours + 'h&nbsp;' + minutes + 'm&nbsp;' + seconds + 's');
        });
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

    function showNotification(notificationText) {
        if (!notificationsContainer) {
            notificationsContainer = document.createElement('div');
            notificationsContainer.id = ID_PREFIX + 'notifications_container';
            let style = 'position: fixed; z-index: 1;';
            style += 'bottom: 0; left: 0; width: 100%;';
            style += 'display: flex; flex-direction: column; gap: 8px;';
            style += 'align-items: center; padding-bottom: 8px;';
            style += 'background: linear-gradient(0deg, black, transparent)';
            notificationsContainer.style = style;

            document.body.appendChild(notificationsContainer);
        }

        const notification = document.createElement('h3');
        notification.id = ID_PREFIX + 'notification_' + (new Date().getTime());
        notification.classList.add('head_padding', 'back_pink', 'center');
        let style = 'width: 80%; cursor: pointer;';
        notification.style = style;
        notification.innerHTML = notificationText;
        notification.addEventListener('click', () => {
            notification.remove();
        });
        notificationsContainer.appendChild(notification);
    }

    function createOptionsPanel(container) {
        if (!container) {
            console.error('createOptionsPanel(): No container provided');
            return;
        }

        const optionsPanel = document.createElement('div');
        optionsPanel.classList.add('in', 'back_primary', 'shadow_box');
        container.appendChild(optionsPanel);

        const title = document.createElement('h3');
        title.classList.add('head_padding', 'back_orange', 'center');
        title.innerText = 'HLTB+';
        optionsPanel.appendChild(title);

        const journalFieldset = document.createElement('fieldset');
        journalFieldset.classList.add('options-module__S5himG__radios', 'spreadsheet');
        optionsPanel.appendChild(journalFieldset);

        const journalFieldsetTitle = document.createElement('h4');
        journalFieldsetTitle.innerText = 'Journal:';
        journalFieldsetTitle.title = 'If enabled a new tab "Journal" will be added with detailed info about your game sessions';
        journalFieldset.appendChild(journalFieldsetTitle);

        const journalFieldsetCbContainer = document.createElement('div');
        journalFieldset.appendChild(journalFieldsetCbContainer);

        const journalEnabledCb = document.createElement('input');
        journalEnabledCb.id = ID_PREFIX + 'journal_enabled';
        journalEnabledCb.classList.add('form_checkbox');
        journalEnabledCb.type = 'checkbox';
        journalEnabledCb.checked = options.journalEnabled;
        journalFieldsetCbContainer.appendChild(journalEnabledCb);

        const journalEnabledLabel = document.createElement('label');
        journalEnabledLabel.setAttribute('for', ID_PREFIX + 'journal_enabled');
        journalEnabledLabel.innerText = 'Enabled';
        journalFieldsetCbContainer.appendChild(journalEnabledLabel);

        const saveButtonContainer = document.createElement('div');
        saveButtonContainer.classList.add('right');
        optionsPanel.appendChild(saveButtonContainer);

        const saveButton = document.createElement('input');
        saveButton.type = 'button';
        saveButton.classList.add('form_button', 'form_blue', 'primary');
        saveButton.value = 'Save';
        saveButton.addEventListener('click', () => {
            options.journalEnabled = journalEnabledCb.checked;
            saveOptions();
            showNotification('HLTB+ options saved. Reload page to apply changes.');
        });
        saveButtonContainer.appendChild(saveButton);
    }

    function addJournalTab(navigationElement) {
        const tabId = ID_PREFIX + 'journal_tab';
        if (navigationElement.querySelector('#' + tabId))
            return;

        const journalTab = document.createElement('li');
        journalTab.id = tabId;
        navigationElement.querySelector('ul').appendChild(journalTab);

        const link = document.createElement('a');
        link.innerText = 'Journal';
        link.href = '#';
        link.addEventListener('click', () => {
            const activeTabContent = document.querySelector('.contain_out:last-of-type');
            activeTabContent.style.display = 'none';

            const activeClass = 'back_pink'
            journalTab.classList.add(activeClass);

            const tabs = navigationElement.querySelectorAll('li');
            Array.from(tabs).forEach(tab => {
                if (tab === journalTab)
                    return;
                tab.classList.remove(activeClass);
                tab.addEventListener('click', () => {
                    tab.classList.add(activeClass);
                    activeTabContent.style.display = 'block';
                    journalTab.classList.remove(activeClass);
                });
            });

            addJournalTabContent(activeTabContent);
        });
        journalTab.appendChild(link);
    }

    function addJournalTabContent(activeTabContent) {
        const tabContentId = ID_PREFIX + 'journal_tab_content';
        if (document.querySelector('#' + tabContentId))
            return;

        console.log('addJournalTabContent not yet implemented');
    }
})();