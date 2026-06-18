// ==UserScript==
// @name         HLTB+
// @namespace    http://tampermonkey.net/
// @version      0.8
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

    function createGameFromPageData() {
        const linkParts = window.location.href.split('/');
        const imgParts = document.querySelector('#tool_community img').src.split('/');
        return new Game(
            document.querySelector('input[name="title"]').value,
            linkParts[linkParts.length - 1],
            imgParts[imgParts.length - 1].split('?')[0]
        );
    }

    function customizeCurrentProgress(currentProgressElement) {
        editPage.currentProgress = getCurrentProgressInSeconds(currentProgressElement);

        const saveBtn = document.querySelector('.global_padding_big.form_blue');
        saveBtn.addEventListener('click', () => {
            const savedProgress = getCurrentProgressInSeconds(currentProgressElement);
            const totalSeconds = savedProgress - editPage.currentProgress;
            if (totalSeconds <= 0)
                return;

            const hours = Math.floor(totalSeconds / 3600);
            const minutes = Math.floor((totalSeconds % 3600) / 60);
            const seconds = totalSeconds % 60;
            const game = createGameFromPageData();
            showNotification('Game: ' + game.title + ' - Session duration: ' + hours + 'h&nbsp;' + minutes + 'm&nbsp;' + seconds + 's');

            if (options.journalEnabled) {
                addSession(new Session(
                    game,
                    new Date(new Date().getTime() - (totalSeconds * 1000)),
                    totalSeconds * 1000
                ));
            }
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

    function loadGames() {
        const gamesRaw = localStorage.getItem(ID_PREFIX + 'games');
        return gamesRaw ? JSON.parse(gamesRaw) : [];
    }

    function saveGames(games) {
        localStorage.setItem(ID_PREFIX + 'games', JSON.stringify(games));
    }

    function loadSessions() {
        const sessionsRaw = localStorage.getItem(ID_PREFIX + 'sessions');
        const sessions = sessionsRaw ? JSON.parse(sessionsRaw) : [];
        return sessions.map(
            session => new Session(
                loadGames().find(game => game.link === session.game),
                new Date(session.date),
                session.duration)
        );
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
            JSON.stringify(sessions.map(session => new Session(session.game.link, session.date.getTime(), session.duration)))
        );
    }

    function addSession(session) {
        const sessions = loadSessions();
        sessions.push(session);
        saveSessions(sessions);
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
        leftColumn.appendChild(calendarPanel);

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
        const journal = new Journal(journalPanel, now, loadSessions(),
            () => { calendar.moveToPrevDate(); },
            () => { calendar.moveToNextDate(); }
        );
        const calendar = new Calendar(calendarPanel, now, newDate => {
            journal.setDate(newDate);
        });
    }

    function removeJournalTabContainer() {
        if (!journalTabContainer)
            return;

        journalTabContainer.remove();
        journalTabContainer = null;
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
            this.renderDatePicker();
        }

        renderTitle() {
            const title = document.createElement('h3');
            title.classList.add('head_padding', 'back_primary', 'center');
            title.innerText = 'Calendar';
            this.container.appendChild(title);
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
            this.datePicker.addEventListener('change', event => this.onDateChange(new Date(this.datePicker.value)));
            this.updateDatepickerDate();
            fieldset.appendChild(this.datePicker);
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
        constructor(container, date, sessions, onPrevDateCb, onNextDateCb) {
            this.container = container;
            this.date = date;
            this.sessions = sessions;
            this.onPrevDateCb = onPrevDateCb;
            this.onNextDateCb = onNextDateCb;
            this.render();
        }

        setDate(date) {
            this.date = date;
            this.updateTitleText();
            this.renderEntries();
        }

        deleteJournalEntry(session) {
            if (confirm('Are you sure you want to delete this journal entry?')) {
                const index = this.sessions.findIndex(s => s.game.link === session.game.link && s.date.getTime() === session.date.getTime());
                if (index !== -1) {
                    this.sessions.splice(index, 1);
                    saveSessions(this.sessions);
                    this.renderEntries();
                }
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
            const entries = this.container.querySelectorAll('.' + ID_PREFIX + 'journal_entry');
            entries.forEach(entry => entry.remove());
            this.container.querySelector('h4')?.remove();

            let sessionsCount = 0;
            this.sessions.forEach(session => {
                if (session.date.getFullYear() === this.date.getFullYear() && session.date.getMonth() === this.date.getMonth() && session.date.getDate() === this.date.getDate()) {
                    this.renderJournalEntry(session);
                    sessionsCount++;
                }
            });
            if (sessionsCount === 0)
                this.renderNoDataMessage();
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
            duration.innerText = this.formatDuration(session.duration);
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
            titleText.innerText = this.date.toISOString().split('T')[0] + ' Sessions';
        }

        formatDuration(duration) {
            const totalSeconds = duration / 1000;
            const hours = Math.floor(totalSeconds / 3600);
            const minutes = Math.floor((totalSeconds % 3600) / 60);
            const seconds = totalSeconds % 60;
            return 'Duration: ' + hours + 'h ' + minutes + 'm ' + seconds + 's';
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
})();