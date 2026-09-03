// ==UserScript==
// @name         HLTB+
// @namespace    http://tampermonkey.net/
// @version      0.9.2
// @description  QoL improvements for HLTB
// @author       RunePML
// @match        https://howlongtobeat.com/*
// @icon         https://www.google.com/s2/favicons?sz=64&domain=howlongtobeat.com
// @grant        none
// @downloadURL https://update.greasyfork.org/scripts/583271/HLTB%2B.user.js
// @updateURL https://update.greasyfork.org/scripts/583271/HLTB%2B.meta.js
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
    let journalTabContainer = null;

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
                if (attempts > maxAttempts)
                    clearInterval(waitInterval);
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
        removeJournalTabContainer();

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
        waitForElement('.contain_out:nth-child(2) .contain_in', optionsContainer => {
            const optionsColumns = optionsContainer.querySelectorAll('.content_33');
            createOptionsPanel(optionsColumns[optionsColumns.length - 1]);
        });
    }

    function isUserLoggedIn() {
        return document.querySelectorAll('[class*="UserTools"]').length !== null;
    }

    function getUsername() {
        return isUserLoggedIn()
            ? document.querySelector('.label[class*="UserTools"]').innerText
            : null;
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

    function createGameFromPageData(doc, gameLink) {
        const linkParts = gameLink ? '' : window.location.href.split('/');
        const imageElement = doc.querySelector('#tool_community img');
        const imgParts = imageElement ? imageElement.src.split('/') : [];
        const title = doc.querySelector('input[name="title"]')
            ? doc.querySelector('input[name="title"]').value
            : doc.querySelector('meta[property="og:title"]').content.split(' - ')[0];
        return new Game(
            title,
            gameLink ? gameLink : linkParts[linkParts.length - 1],
            imgParts.length > 0 ? imgParts[imgParts.length - 1].split('?')[0] : ''
        );
    }

    function formatDuration(seconds) {
        const hours = Math.floor(seconds / 3600);
        const minutes = Math.floor((seconds % 3600) / 60);
        return { h: hours, m: minutes, s: seconds % 60 };
    }

    function formatDate(date) {
        return date.getDate() + '-' + (date.getMonth() + 1) + '-' + date.getFullYear();
    }

    function customizeCurrentProgress(currentProgressElement) {
        editPage.currentProgress = getCurrentProgressInSeconds(currentProgressElement);

        const saveBtn = document.querySelector('.global_padding_big.form_blue');
        saveBtn.addEventListener('click', () => {
            const savedProgress = getCurrentProgressInSeconds(currentProgressElement);
            const totalSeconds = savedProgress - editPage.currentProgress;
            if (totalSeconds <= 0)
                return;

            const game = createGameFromPageData(document, null);
            const duration = formatDuration(totalSeconds);
            showNotification('Game: ' + game.title + ' - Session duration: ' + duration.h + 'h&nbsp;' + duration.m + 'm&nbsp;' + duration.s + 's');

            if (options.journalEnabled) {
                addSession(new Session(
                    game,
                    new Date(new Date().getTime() - (totalSeconds * 1000)),
                    totalSeconds * 1000
                ));
            }
        });
    }

    function saveFile(fileName, data, type) {
        const blob = new Blob([data], { type: type });
        const url = URL.createObjectURL(blob);
        const link = document.createElement("a");
        link.href = url;
        link.download = fileName;
        link.click();
        URL.revokeObjectURL(url);
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

                saveFile('games-' + currentPage[3] + '.csv', csv, 'text/csv');
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
            if (notificationsContainer.childNodes.length === 0) {
                notificationsContainer.remove();
                notificationsContainer = null;
            }
        });
        notificationsContainer.appendChild(notification);
    }

    function loadGames() {
        const gamesRaw = localStorage.getItem(ID_PREFIX + 'games');
        return gamesRaw ? JSON.parse(gamesRaw) : [];
    }

    function saveGames(games) {
        localStorage.setItem(ID_PREFIX + 'games', JSON.stringify(games));
    }

    async function findGame(gameLink) {
        const game = loadGames().find(game => game.link === gameLink)
        if (game)
            return game;

        const response = await fetch('https://howlongtobeat.com/submit/edit/' + gameLink);
        const html = await response.text();
        const domParser = new DOMParser();
        const doc = domParser.parseFromString(html, 'text/html');
        return createGameFromPageData(doc, gameLink);
    }

    function compressSessions(sessions) {
        return sessions.map(session => new Session(session.game.link, session.date.getTime(), session.duration));
    }

    async function decompressSessions(sessions) {
        return await Promise.all(
            sessions.map(async (session) => {
                const game = await findGame(session.game);
                return new Session(
                    game,
                    new Date(session.date),
                    session.duration
                )
            })
        );
    }

    async function loadSessions() {
        const sessionsRaw = localStorage.getItem(ID_PREFIX + 'sessions');
        const sessions = sessionsRaw ? JSON.parse(sessionsRaw) : [];
        return await decompressSessions(sessions);
    }

    function saveSessions(sessions) {
        const games = loadGames();
        sessions.forEach(session => {
            if (!games.find(game => game.link === session.game.link))
                games.push(session.game);
        });
        saveGames(games);

        localStorage.setItem(
            ID_PREFIX + 'sessions',
            JSON.stringify(compressSessions(sessions))
        );
    }

    async function addSession(session) {
        await loadSessions().then(sessions => {
            sessions.push(session);
            saveSessions(sessions);
        });
    }

    function loadSessionsToRemove() {
        const toRemove = localStorage.getItem(ID_PREFIX + 'sessions-to-remove');
        return toRemove ? JSON.parse(toRemove) : [];
    }

    function saveSessionsToRemove(toRemove) {
        localStorage.setItem(
            ID_PREFIX + 'sessions-to-remove',
            JSON.stringify(toRemove)
        );
    }

    async function removeSession(session) {
        let sessionRemoved = false;
        await loadSessions().then(sessions => {
            const index = sessions.findIndex(s => s.game.link === session.game.link && s.date.getTime() === session.date.getTime());
            if (index !== -1) {
                sessions.splice(index, 1);
                saveSessions(sessions);
                const toRemove = loadSessionsToRemove();
                toRemove.push({ link: session.game.link, date: session.date.getTime() });
                saveSessionsToRemove(toRemove);
                sessionRemoved = true;
            }
        });
        return sessionRemoved;
    }

    async function exportJournal() {
        await loadSessions().then(sessions => {
            saveFile('journal.json', JSON.stringify(sessions), 'text/json');
            showNotification('Journal data has been exported to journal.json');
        });
    }

    async function importJournal(importMode) {
        const errorMessage = 'File is invalid or data is corrupt';
        const fileInput = document.createElement('input');
        fileInput.type = 'file';
        fileInput.accept = '.json';
        fileInput.addEventListener('change', () => {
            const file = fileInput.files?.[0];
            if (!file) {
                showNotification('Select a valid file');
                return;
            }

            const reader = new FileReader();
            reader.readAsText(file, 'UTF-8');
            reader.onload = async ({ target }) => {
                const text = target.result;
                try {
                    const journal = JSON.parse(text).map(entry => new Session(
                        entry.game,
                        new Date(entry.date),
                        entry.duration
                    ));

                    switch (importMode) {
                        case 'overwrite':
                            saveSessions(journal);
                            showNotification('Journal data has been imported successfully, reload to see changes.');
                            break;
                        case 'merge':
                            const newEntries = await mergeJournals(journal);
                            showNotification(newEntries + ' new entries added to the Journal');
                            break;
                    }
                } catch (error) {
                    showNotification(errorMessage);
                }
            }
            reader.onerror = () => {
                showNotification(errorMessage);
            }
        });
        fileInput.click();
    }

    async function mergeJournals(journalToMerge) {
        const sessions = await loadSessions();
        const mergedSessions = await loadSessions();
        let newEntries = 0;
        journalToMerge.forEach(entry => {
            if (!sessions.find(s => s.game.link === entry.game.link && s.date.getTime() === entry.date.getTime())) {
                mergedSessions.push(entry);
                newEntries++;
            }
        });
        saveSessions(mergedSessions);
        return newEntries;
    }

    async function syncJournal() {
        showNotification('Syncing Journal data...');
        fetchSyncJournalData(async (sessions, sessionsToRemove) => {
            if (sessions) {
                const decompressedSessions = await decompressSessions(sessions);
                const newEntries = await mergeJournals(decompressedSessions);
                if (newEntries > 0)
                    showNotification(newEntries + ' new entries added to the Journal');
            }
            if (sessionsToRemove && sessionsToRemove.length > 0) {
                let removedEntries = 0;
                sessionsToRemove.forEach(async toRemove => {
                    const removed = await removeSession(new Session(
                        new Game('', toRemove.link, null),
                        new Date(toRemove.date),
                        0
                    ));
                    if (removed)
                        removedEntries++;
                });
                saveSessionsToRemove([]);
                if (removedEntries > 0)
                    showNotification(removedEntries + ' entries removed from the Journal');
            }
            loadSessions().then(loadedSessions => pushSyncJournalData(loadedSessions, () => {
                showNotification('Journal data synchronized successfully');
            }));
        });
    }

    function fetchSyncJournalData(onFetch) {
        const user = getUsername();
        const url = 'https://howlongtobeat.com/user/' + user + '/pm/' + user;
        fetch(url, { method: 'GET' })
            .then(response => response.text())
            .then(data => {
                const startSearchString = '<script id="__NEXT_DATA__" type="application/json">';
                const jsonStart = data.indexOf(startSearchString);
                const jsonEnd = data.indexOf('</script>', jsonStart);
                const parsedJson = JSON.parse(data.substring(jsonStart + startSearchString.length, jsonEnd));
                const pms = parsedJson.props.pageProps.userPMs;
                if (pms.length == 0) {
                    onFetch(null);
                    return;
                }
                // It is assumed that there is only one PM containing the data
                const pm = JSON.parse(pms[0].pm_message);
                onFetch(pm.journal, pm.sessionsToRemove);
            });
    }

    function pushSyncJournalData(sessions, onPush) {
        // First delete existing data
        fetch('https://howlongtobeat.com/api/user/pm/delete', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json;charset=utf-8' },
            body: JSON.stringify({ conversationWith: getUsername() })
        }).then(() => {
            fetch('https://howlongtobeat.com/api/user/pm/send', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json;charset=utf-8' },
                body: JSON.stringify({
                    conversationWith: getUsername(),
                    message: JSON.stringify({
                        journal: compressSessions(sessions),
                        sessionsToRemove: loadSessionsToRemove()
                    })
                })
            }).then(() => onPush());
        });
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
        journalFieldset.classList.add('options-module__S5himG__fields', 'spreadsheet');
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
            const activeTabContent = document.querySelector('.contain_out:nth-child(2)');
            activeTabContent.style.display = 'none';

            const activeClass = 'back_pink';
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
                    removeJournalTabContainer();
                });
            });

            addJournalTabContainer(activeTabContent.parentElement);
        });
        journalTab.appendChild(link);
    }

    function addJournalTabContainer(container) {
        if (journalTabContainer)
            return;

        journalTabContainer = document.createElement('div');
        journalTabContainer.id = ID_PREFIX + 'journal_tab_content';
        journalTabContainer.classList.add('contain_out');
        container.appendChild(journalTabContainer);

        const innerContainer = document.createElement('div');
        innerContainer.classList.add('contain_in');
        journalTabContainer.appendChild(innerContainer);

        const leftColumn = document.createElement('div');
        leftColumn.classList.add('content_25_extend', 'spaced');
        innerContainer.appendChild(leftColumn);

        const calendarPanel = document.createElement('div');
        calendarPanel.classList.add('in', 'back_secondary', 'shadow_box');
        calendarPanel.style.marginBottom = '12px';
        leftColumn.appendChild(calendarPanel);

        const summaryPanel = document.createElement('div');
        summaryPanel.classList.add('in', 'back_primary', 'shadow_box');
        leftColumn.appendChild(summaryPanel);

        const rightColumn = document.createElement('div');
        rightColumn.classList.add('content_75', 'spaced');
        innerContainer.appendChild(rightColumn);

        const journalPanel = document.createElement('div');
        journalPanel.classList.add('in', 'back_primary', 'shadow_box');
        rightColumn.appendChild(journalPanel);

        const clear = document.createElement('div');
        clear.classList.add('clear');
        innerContainer.appendChild(clear);

        const now = new Date();
        const journal = new Journal(
            journalPanel,
            now,
            () => { calendar.moveToPrevDate(); },
            () => { calendar.moveToNextDate(); }
        );
        const summary = new Summary(summaryPanel, now);
        const calendar = new Calendar(
            calendarPanel,
            now,
            newDate => {
                journal.setDate(newDate);
                summary.setDate(newDate);
            }
        );
    }

    function removeJournalTabContainer() {
        if (!journalTabContainer)
            return;

        journalTabContainer.remove();
        journalTabContainer = null;
    }


    function normalizeDate(date) {
        return new Date(date.getFullYear(), date.getMonth(), date.getDate());
    }

    function filterSessionsByDates(sessions, dateStart, dateEnd) {
        const nDateStart = normalizeDate(dateStart);
        const nDateEnd = normalizeDate(dateEnd ? dateEnd : dateStart);
        return sessions.filter(session => {
            const nDate = normalizeDate(session.date);
            return nDate >= nDateStart && nDate <= nDateEnd
        });
    }

    class Game {
        constructor(title, link, image) {
            this.title = title;
            this.link = link;
            this.image = image;
        }
    }

    class Session {
        constructor(game, date, duration) {
            this.game = game;
            this.date = date;
            this.duration = duration;
        }
    }

    class Calendar {
        constructor(container, date, onDateChange) {
            this.container = container;
            this.date = date;
            this.onDateChange = onDateChange;
            this.datePicker = null;
            this.render();
        }

        render() {
            this.renderTitle();
            this.renderActions();
            this.renderDatePicker();
        }

        renderTitle() {
            const title = document.createElement('h3');
            title.classList.add('head_padding', 'back_primary', 'center');
            title.innerText = 'Calendar';
            this.container.appendChild(title);
        }

        renderActions() {
            const actions = document.createElement('div');
            actions.style.display = 'flex';
            actions.style.justifyContent = 'space-evenly';
            this.container.appendChild(actions);

            actions.appendChild(this.createAction(
                'back_green',
                'Export',
                'Export Journal data to a file',
                exportJournal
            ));

            const openImportActions = () => {
                const importActions = document.getElementById(ID_PREFIX + 'import_actions');
                importActions.style.display = 'flex';
            }

            const closeImportActions = () => {
                const importActions = document.getElementById(ID_PREFIX + 'import_actions');
                importActions.style.display = 'none';
            }

            const importBtn = this.createAction(
                'back_blue',
                'Import',
                'Import Journal data from a file',
                () => openImportActions()
            )
            importBtn.addEventListener('blur', () => { setTimeout(() => closeImportActions(), 500) });
            importBtn.style.position = 'relative';
            actions.appendChild(importBtn);

            const importActions = document.createElement('div');
            importActions.id = ID_PREFIX + 'import_actions';
            importActions.classList.add('back_primary', 'shadow_box');
            importActions.style.position = 'absolute';
            importActions.style.zIndex = 1;
            importActions.style.left = 0;
            importActions.style.padding = '4px';
            importActions.style.top = '32px';
            importActions.style.display = 'none';
            importActions.style.flexDirection = 'column';
            importBtn.appendChild(importActions);

            importActions.appendChild(this.createAction(
                'back_blue',
                'Overwrite',
                'The existing Journal data will be replaced by the imported entries',
                () => importJournal('overwrite')
            ));

            importActions.appendChild(this.createAction(
                'back_blue',
                'Merge',
                'The existing Journal data will be merged with the new imported entries',
                () => importJournal('merge')
            ));

            actions.appendChild(this.createAction(
                'back_purple',
                'Sync',
                'Synchronize the Journal data in this browser with other browsers to have an unified log',
                syncJournal
            ));
        }

        renderDatePicker() {
            const fieldset = document.createElement('fieldset');
            fieldset.classList.add('options-module__S5himG__radios', 'spreadsheet');
            this.container.appendChild(fieldset);

            const title = document.createElement('h4');
            title.innerText = 'Date:';
            fieldset.appendChild(title);

            this.datePicker = document.createElement('input');
            this.datePicker.classList.add('form_text', 'back_form');
            this.datePicker.type = 'date';
            this.datePicker.addEventListener('change', event => {
                this.date = new Date(this.datePicker.value);
                this.onDateChange(this.date);
            });
            this.updateDatepickerDate();
            fieldset.appendChild(this.datePicker);
        }

        createAction(colorClass, label, title, onClick) {
            const button = document.createElement('button');
            button.type = 'button';
            button.classList.add('form_button', colorClass);
            button.innerText = label;
            button.title = title;
            button.addEventListener('click', () => onClick());
            return button;
        }

        updateDatepickerDate(date) {
            this.datePicker.value = this.date.toISOString().split('T')[0];
            this.datePicker.dispatchEvent(new Event('change'));
        }

        moveToPrevDate() {
            this.date.setDate(this.date.getDate() - 1);
            this.updateDatepickerDate();
        }

        moveToNextDate() {
            this.date.setDate(this.date.getDate() + 1);
            this.updateDatepickerDate();
        }
    }

    class Journal {
        constructor(container, date, onPrevDateCb, onNextDateCb) {
            this.container = container;
            this.date = date;
            this.onPrevDateCb = onPrevDateCb;
            this.onNextDateCb = onNextDateCb;
            this.render();
        }

        setDate(date) {
            this.date = date;
            this.updateTitleText();
            this.renderEntries();
        }

        async deleteJournalEntry(session) {
            if (confirm('Are you sure you want to delete this journal entry?')) {
                await removeSession(session);
                this.renderEntries();
            }
        }

        render() {
            this.renderTitle();
            this.renderEntries();
        }

        renderTitle() {
            const title = document.createElement('h3');
            title.classList.add('head_padding', 'back_orange', 'center');
            title.style.display = 'flex';
            title.style.justifyContent = 'space-between';
            this.container.appendChild(title);

            const prevButton = document.createElement('button');
            prevButton.innerHTML = '&lt;';
            prevButton.addEventListener('click', this.onPrevDateCb);
            title.appendChild(prevButton);

            const titleText = document.createElement('span');
            titleText.id = ID_PREFIX + 'journal_title_text';
            title.appendChild(titleText);
            this.updateTitleText();

            const nextButton = document.createElement('button');
            nextButton.innerHTML = '&gt;';
            nextButton.addEventListener('click', this.onNextDateCb);
            title.appendChild(nextButton);
        }

        renderEntries() {
            loadSessions().then(sessions => {
                const entries = this.container.querySelectorAll('.' + ID_PREFIX + 'journal_entry');
                entries.forEach(entry => entry.remove());
                this.container.querySelector('h4')?.remove();

                let filteredSessions = filterSessionsByDates(sessions, this.date);
                filteredSessions.forEach(session => {
                    this.renderJournalEntry(session);
                });
                if (filteredSessions.length === 0)
                    this.renderNoDataMessage();
            });
        }

        renderNoDataMessage() {
            const message = document.createElement('h4');
            message.classList.add('center');
            message.innerText = '-- No Data --';
            this.container.appendChild(message);
        }

        renderJournalEntry(session) {
            const entry = document.createElement('div');
            entry.classList.add(ID_PREFIX + 'journal_entry');
            this.container.appendChild(entry);

            const innerContainer = document.createElement('div');
            innerContainer.classList.add('in', 'spreadsheet');
            innerContainer.style.display = 'flex';
            innerContainer.style.flexDirection = 'row';
            innerContainer.style.justifyContent = 'space-between';
            entry.appendChild(innerContainer);

            const data = document.createElement('div');
            innerContainer.appendChild(data);

            const title = document.createElement('h4');
            title.style.display = 'flex';
            title.style.flexDirection = 'row';
            title.style.gap = '8px';
            data.appendChild(title);

            const titleLink = document.createElement('a');
            titleLink.href = '/submit/edit/' + session.game.link;
            titleLink.innerText = session.game.title;
            title.appendChild(titleLink);

            this.renderEntryActions(session, title);

            const duration = document.createElement('strong');
            const d = formatDuration(session.duration / 1000);
            duration.innerText = d.h + 'h ' + d.m + 'm ' + d.s + 's';
            data.appendChild(duration);

            const timeFromTo = document.createElement('div');
            timeFromTo.classList.add('text_grey');
            timeFromTo.innerText = this.formatTimeFromTo(session);
            data.appendChild(timeFromTo);

            const image = document.createElement('img');
            image.width = 66;
            image.src = '/games/' + session.game.image;
            image.style.borderRadius = '3px';
            innerContainer.appendChild(image);
        }

        renderEntryActions(session, container) {
            const deleteAction = document.createElement('img');
            deleteAction.src = '/img/icon_delete.png';
            deleteAction.width = '23';
            deleteAction.height = '23';
            deleteAction.title = 'Delete entry';
            deleteAction.style.cursor = 'pointer';
            deleteAction.addEventListener('click', () => { this.deleteJournalEntry(session) });
            container.appendChild(deleteAction);
        }

        updateTitleText() {
            const titleText = document.querySelector('#' + ID_PREFIX + 'journal_title_text');
            titleText.innerText = formatDate(this.date) + ' Sessions';
        }

        formatTimeFromTo(session) {
            const format = (number) => {
                return number >= 10
                    ? number.toString()
                    : '0' + number.toString()
            };
            const start = format(session.date.getHours()) + ':' + format(session.date.getMinutes());
            const endTime = new Date(session.date.getTime() + session.duration);
            const end = format(endTime.getHours()) + ':' + format(endTime.getMinutes());
            return 'From ' + start + ' to ' + end;
        }
    }

    class Summary {
        constructor(container, date) {
            this.container = container;
            this.date = date;
            this.dateStart = null;
            this.dateEnd = null;
            this.range = 'day';
            this.rangeSelector = null;
            this.rangeDayBtn = null;
            this.rangeWeekBtn = null;
            this.rangeMonthBtn = null;
            this.rangeYearBtn = null;
            this.fromToDates = null;
            this.gamesCount = null;
            this.sessionsCount = null;
            this.timeSummary = null;
            this.ranking = null;
            this.render();
            this.setRange(this.range);
        }

        setDate(date) {
            this.date = date;
            this.updateSummary();
        }

        calculateRangeDates() {
            switch (this.range) {
                case 'day':
                    this.dateStart = new Date(this.date.getFullYear(), this.date.getMonth(), this.date.getDate());
                    this.dateEnd = this.dateStart;
                    break;
                case 'week':
                    this.dateStart = new Date(this.date.getFullYear(), this.date.getMonth(), this.date.getDate());
                    let day = this.dateStart.getDay() || 7;
                    if (day !== 1)
                        this.dateStart.setHours(-24 * (day - 1));
                    this.dateEnd = new Date(this.dateStart.getFullYear(), this.dateStart.getMonth(), this.dateStart.getDate() + 6);
                    break;
                case 'month':
                    this.dateStart = new Date(this.date.getFullYear(), this.date.getMonth(), 1);
                    this.dateEnd = new Date(this.date.getFullYear(), this.date.getMonth(), new Date(this.date.getFullYear(), this.date.getMonth() + 1, 0).getDate());
                    break;
                case 'year':
                    this.dateStart = new Date(this.date.getFullYear(), 0, 1);
                    this.dateEnd = new Date(this.date.getFullYear(), 11, 31);
                    break;
            }
        }

        setRange(range) {
            this.range = range;

            [this.rangeDayBtn, this.rangeWeekBtn, this.rangeMonthBtn, this.rangeYearBtn].forEach(btn => {
                if (btn.classList.contains(this.range)) {
                    btn.classList.remove('back_secondary');
                    btn.classList.add('back_green');
                } else {
                    btn.classList.remove('back_green');
                    btn.classList.add('back_secondary');
                }
            });

            this.updateSummary();
        }

        render() {
            this.renderTitle();
            this.renderRangeSelector();
            this.renderFromToDates();
            this.renderSummary();
            this.renderRanking();
        }

        renderTitle() {
            const title = document.createElement('h3');
            title.classList.add('head_padding', 'back_orange', 'center');
            title.innerText = 'Summary';
            this.container.appendChild(title);
        }

        renderRangeSelector() {
            this.rangeSelector = document.createElement('div');
            this.rangeSelector.style.display = 'flex';
            this.container.appendChild(this.rangeSelector);

            this.rangeDayBtn = this.addRangeButton('Day', 'day');
            this.rangeWeekBtn = this.addRangeButton('Week', 'week');
            this.rangeMonthBtn = this.addRangeButton('Month', 'month');
            this.rangeYearBtn = this.addRangeButton('Year', 'year');
        }

        renderFromToDates() {
            this.fromToDates = document.createElement('h4');
            this.fromToDates.style.padding = '4px 10px';
            this.fromToDates.innerHTML = 'From <span class="from text_grey"></span> to <span class="to text_grey"></span>';
            this.container.appendChild(this.fromToDates);
        }

        renderSummary() {
            this.gamesCount = this.addField('Unique games played');
            this.sessionsCount = this.addField('Play sessions');
            this.timeSummary = this.addField('Time played');
        }

        renderRanking() {
            const title = document.createElement('h4');
            title.style.padding = '4px 0';
            title.innerText = 'Most played games'
            this.container.appendChild(title);

            this.ranking = document.createElement('div');
            this.ranking.style.display = 'flex';
            this.ranking.style.justifyContent = 'space-around';
            this.container.appendChild(this.ranking);
        }

        addRangeButton(label, range) {
            const button = document.createElement('button');
            button.style.flex = '1';
            button.classList.add(range, 'form_button', 'back_secondary');
            button.innerText = label;
            button.addEventListener('click', () => this.setRange(range));
            this.rangeSelector.appendChild(button);
            return button;
        }

        addField(label) {
            const field = document.createElement('h4');
            field.style.padding = '4px 10px';
            field.style.display = 'flex';
            field.style.justifyContent = 'space-between';
            field.innerHTML = label + ': <span class="text_grey"></span>';
            this.container.appendChild(field);
            return field;
        }

        updateFromToDates() {
            if (this.range === 'day') {
                this.fromToDates.style.display = 'none';
                return;
            }
            this.fromToDates.style.display = 'block';

            this.fromToDates.querySelector('.from').innerText = formatDate(this.dateStart);
            this.fromToDates.querySelector('.to').innerText = formatDate(this.dateEnd);
        }

        updateSummary() {
            loadSessions().then(sessions => {
                this.calculateRangeDates();
                this.updateFromToDates();

                const filteredSessions = filterSessionsByDates(sessions, this.dateStart, this.dateEnd);
                let gameIds = [];
                let totalTime = 0;

                filteredSessions.forEach(session => {
                    if (gameIds.indexOf(session.game.link) < 0)
                        gameIds.push(session.game.link);
                    totalTime += session.duration;
                });

                this.gamesCount.querySelector('span').innerText = gameIds.length;
                this.sessionsCount.querySelector('span').innerText = filteredSessions.length;
                const d = formatDuration(totalTime / 1000);
                this.timeSummary.querySelector('span').innerText = d.h + 'h ' + d.m + 'm ' + d.s + 's';

                this.updateRanking(filteredSessions);
            });
        }

        updateRanking(filteredSessions) {
            this.ranking.innerHTML = '';

            const gamesRank = [];

            filteredSessions.forEach(session => {
                let gameRank = gamesRank.filter(g => g.game.link === session.game.link)[0];
                if (!gameRank)
                    gamesRank.push({ game: session.game, time: session.duration });
                else
                    gameRank.time += session.duration;
            });

            gamesRank.sort((a, b) => b.time - a.time);

            const rankingSize = 3;
            for (let i = 0; i < gamesRank.length && i < rankingSize; i++) {
                const gameRank = gamesRank[i];

                const rank = document.createElement('a');
                rank.style.display = 'flex';
                rank.style.flexDirection = 'column';
                rank.style.alignItems = 'center';
                rank.href = '/submit/edit/' + gameRank.game.link;
                rank.title = gameRank.game.title;
                this.ranking.appendChild(rank);

                const image = document.createElement('img');
                image.width = 66;
                image.src = '/games/' + gameRank.game.image;
                image.style.borderRadius = '3px';
                rank.appendChild(image);

                const time = document.createElement('span');
                const t = formatDuration(gameRank.time / 1000);
                time.innerText = t.h + 'h ' + t.m + 'm ' + t.s + 's'
                rank.appendChild(time);
            }
        }
    }
})();