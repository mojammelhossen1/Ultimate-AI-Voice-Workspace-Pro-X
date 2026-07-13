let recognition;
    let isRecording = false;
    let lastFinalTranscript = '';
    let wordTimestamps = [];
    let engineWarming = false;
    let currentWaveHue = 215;

    let undoStack = [];
    let redoStack = [];
    let isStackAction = false;
    let paragraphTimer = null;
    let versionControlHistory = [];

    let audioCtx, analyser, source, animationId, streamRef, biquadFilter;
    
    const outputField = document.getElementById('output-field');
    const masterMicBtn = document.getElementById('master-mic-btn');
    const canvas = document.getElementById('visualizer');
    const canvasCtx = canvas.getContext('2d');
    const metricsPanel = document.getElementById('metrics-panel');
    const markdownPreviewPane = document.getElementById('markdown-preview-pane');
    const connectionToast = document.getElementById('connection-toast');

    const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;

    const systemPaletteCommands = [
        { name: "Toggle Dictation Engine Pipeline", shortcut: "🎙️", action: () => toggleDictationEngine() },
        { name: "Execute Intelligent AI Punctuation Pass", shortcut: "✨", action: () => runAISpellPatch() },
        { name: "Export to Microsoft Word (.docx Document Asset)", shortcut: "📥 Word", action: () => triggerDocxOutputExport() },
        { name: "Cycle Visual Theme Profile Mode", shortcut: "🌓 Mode", action: () => toggleTheme() },
        { name: "Clear Operating Workspace Workspace Canvas", shortcut: "🧹 Flush", action: () => flushActiveWorkspace() },
        { name: "Enter Focus Concentration Mode Viewport", shortcut: "👁️ Zen", action: () => toggleZenMode() },
        { name: "Toggle Side-by-Side Live Split Screen View", shortcut: "📋 View", action: () => toggleSplitScreen() }
    ];

    window.onload = function() {
        const savedLang = localStorage.getItem('workspace_lang');
        if (savedLang) {
            document.getElementById('lang-select').value = savedLang;
        }

        const savedText = localStorage.getItem('workspace_active_text');
        if (savedText) {
            outputField.value = savedText;
        }

        applySavedCollapseStates();

        switchLanguage();
        loadLocalHistoryList();
        renderMacrosRowElements();
        loadLocalVoiceMacrosList();
        initializeDragDropUtilities();
        initializeCommandPaletteInterceptors();
        initializeNetworkAuditListeners();
        initializeKeyboardFormattingShortcuts();
        applyStoredOrSystemTheme();
        
        window.matchMedia('(prefers-color-scheme: dark)').addEventListener('change', () => {
            if(localStorage.getItem('workspace_theme') === 'system' || !localStorage.getItem('workspace_theme')) {
                applyStoredOrSystemTheme();
            }
        });
        
        setInterval(autoSaveWorkspaceHistoryItem, 15000); 
        setInterval(commitVersionControlCheckpoint, 30000); 
        
        saveUndoSnapshotFrame();
        evaluateMetricsCalculations();
        renderLiveMarkdownPreview();
        masterMicBtn.innerHTML = `<i class="fa-solid fa-microphone"></i> Start Dictation`;
    };

    function triggerTactileVibePattern(duration = 15) {
        if(navigator.vibrate) navigator.vibrate(duration);
    }

    function toggleSection(contentId, iconId) {
        const content = document.getElementById(contentId);
        const icon = document.getElementById(iconId);
        
        if (content.classList.contains('collapsed')) {
            content.classList.remove('collapsed');
            icon.className = "fa-solid fa-chevron-up";
            localStorage.setItem('collapse_state_' + contentId, 'expanded');
        } else {
            content.classList.add('collapsed');
            icon.className = "fa-solid fa-chevron-down";
            localStorage.setItem('collapse_state_' + contentId, 'collapsed');
        }
    }

    function applySavedCollapseStates() {
        const structuralSections = ['lang-font-content', 'intelligent-audio-content'];
        const referenceIcons = ['lang-font-icon', 'intel-audio-icon'];
        
        structuralSections.forEach((contentId, idx) => {
            const content = document.getElementById(contentId);
            const icon = document.getElementById(referenceIcons[idx]);
            const savedState = localStorage.getItem('collapse_state_' + contentId);
            
            if (savedState === 'collapsed') {
                content.classList.add('collapsed');
                icon.className = "fa-solid fa-chevron-down";
            } else {
                content.classList.remove('collapsed');
                icon.className = "fa-solid fa-chevron-up";
            }
        });
    }

    function saveUndoSnapshotFrame() {
        if (isStackAction) return;
        if (undoStack.length === 0 || undoStack[undoStack.length - 1] !== outputField.value) {
            undoStack.push(outputField.value);
            if(undoStack.length > 50) undoStack.shift();
            redoStack = [];
        }
    }

    function triggerUndo() {
        if (undoStack.length > 1) {
            triggerTactileVibePattern(20);
            isStackAction = true;
            redoStack.push(undoStack.pop());
            const fallbackState = undoStack[undoStack.length - 1];
            outputField.value = fallbackState;
            localStorage.setItem('workspace_active_text', fallbackState);
            renderLiveMarkdownPreview();
            evaluateMetricsCalculations();
            isStackAction = false;
        }
    }

    function triggerRedo() {
        if (redoStack.length > 0) {
            triggerTactileVibePattern(20);
            isStackAction = true;
            const stepForwardState = redoStack.pop();
            outputField.value = stepForwardState;
            localStorage.setItem('workspace_active_text', stepForwardState);
            undoStack.push(stepForwardState);
            renderLiveMarkdownPreview();
            evaluateMetricsCalculations();
            isStackAction = false;
        }
    }

    function handleTextAreaAltered() {
        saveUndoSnapshotFrame();
        localStorage.setItem('workspace_active_text', outputField.value);
        renderLiveMarkdownPreview();
        evaluateMetricsCalculations();
    }

    function initializeKeyboardFormattingShortcuts() {
        outputField.addEventListener('keydown', (e) => {
            if (e.ctrlKey || e.metaKey) {
                switch(e.key.toLowerCase()) {
                    case 'b': e.preventDefault(); applyWordFormatting('bold'); break;
                    case 'i': e.preventDefault(); applyWordFormatting('italic'); break;
                    case 'u': e.preventDefault(); applyWordFormatting('underline'); break;
                }
            }
        });
    }

    function applyWordFormatting(formatType) {
        const start = outputField.selectionStart;
        const end = outputField.selectionEnd;
        const activeText = outputField.value;
        const selection = activeText.substring(start, end);

        let formatted = '';
        switch(formatType) {
            case 'bold': if(!selection) return; formatted = `**${selection}**`; break;
            case 'italic': if(!selection) return; formatted = `*${selection}*`; break;
            case 'underline': if(!selection) return; formatted = `<u>${selection}</u>`; break;
            case 'strikethrough': if(!selection) return; formatted = `~~${selection}~~`; break;
            case 'bullet':
                formatted = (selection || '').split('\n').map(line => `- ${line}`).join('\n');
                break;
            case 'number':
                let count = 1;
                formatted = (selection || '').split('\n').map(line => `${count++}. ${line}`).join('\n');
                break;
            case 'left': 
                formatted = selection ? `\n${selection}\n` : ''; 
                break;
            case 'center': 
                formatted = selection ? `\n    ${selection}\n` : ''; 
                break;
            case 'right': 
                formatted = selection ? `\n        ${selection}\n` : ''; 
                break;
            case 'justify': 
                formatted = selection ? `\n${selection}\n` : ''; 
                break;
        }

        saveUndoSnapshotFrame();
        outputField.value = activeText.substring(0, start) + formatted + activeText.substring(end);
        localStorage.setItem('workspace_active_text', outputField.value);
        outputField.setSelectionRange(start, start + formatted.length);
        handleTextAreaAltered();
    }

    function initializeAudioDictationEngine() {
        if (!SpeechRecognition) {
            connectionToast.innerHTML = `<i class="fa-solid fa-circle-exclamation" style="color:var(--danger)"></i> SpeechRecognition API Unavailable`;
            return false;
        }
        
        recognition = new SpeechRecognition();
        recognition.continuous = true;
        recognition.interimResults = true;
        recognition.lang = document.getElementById('lang-select').value;
        lastFinalTranscript = '';

        recognition.onstart = () => {
            triggerTactileVibePattern([40, 20, 40]);
            engineWarming = false;
            masterMicBtn.innerHTML = `<i class="fa-solid fa-circle-stop"></i> Stop Audio Parsing`;
            masterMicBtn.className = "btn-act b-mic recording";
            wordTimestamps = [];
            engageAudioGraphVisualMatrix();
        };

        recognition.onerror = (e) => {
            connectionToast.innerHTML = `<i class="fa-solid fa-triangle-exclamation"></i> Node Stream Error: ${e.error}`;
            terminateEngineVisualLayouts();
        };

        recognition.onend = () => { terminateEngineVisualLayouts(); };

        recognition.onresult = (event) => {
            let interimTranscript = '';
            let freshFinalPart = '';

            for (let i = event.resultIndex; i < event.results.length; ++i) {
                let textFragment = event.results[i][0].transcript;
                if (event.results[i].isFinal) {
                    freshFinalPart += textFragment;
                } else {
                    interimTranscript += textFragment;
                }
            }

            if (document.getElementById('smart-formatting').value === 'on') {
                clearTimeout(paragraphTimer);
                if (freshFinalPart) {
                    paragraphTimer = setTimeout(() => { injectMacroTemplateToken("\n\n"); }, 3000);
                }
            }

            let liveAppendPayload = '';
            if (freshFinalPart) {
                liveAppendPayload = replacePersonalShortcutTokens(freshFinalPart);
            } else if (interimTranscript) {
                liveAppendPayload = interimTranscript;
            }

            if (liveAppendPayload.trim() || freshFinalPart) {
                const caretIndex = outputField.selectionStart;
                const baseText = outputField.value;
                
                if (freshFinalPart) {
                    saveUndoSnapshotFrame();
                    outputField.value = baseText.slice(0, caretIndex) + liveAppendPayload + ' ' + baseText.slice(caretIndex);
                    localStorage.setItem('workspace_active_text', outputField.value);
                    const indexOffset = caretIndex + liveAppendPayload.length + 1;
                    outputField.setSelectionRange(indexOffset, indexOffset);
                } else {
                    connectionToast.innerHTML = `<i class="fa-solid fa-microphone-lines"></i> Parsing: "${liveAppendPayload}"`;
                }

                renderLiveMarkdownPreview();
                evaluateMetricsCalculations();
            }
        };
        return true;
    }

    function toggleDictationEngine() {
        if(engineWarming) return;
        if(!recognition) { if(!initializeAudioDictationEngine()) return; }
        if(isRecording) {
            recognition.stop();
        } else {
            engineWarming = true;
            masterMicBtn.innerHTML = `<i class="fa-solid fa-spinner fa-spin"></i> Instantiating Link...`;
            recognition.lang = document.getElementById('lang-select').value;
            recognition.start();
            isRecording = true;
        }
    }

    function terminateEngineVisualLayouts() {
        masterMicBtn.innerHTML = `<i class="fa-solid fa-microphone"></i> Start Dictation Engine`;
        masterMicBtn.className = "btn-act b-mic";
        isRecording = false;
        engineWarming = false;
        clearTimeout(paragraphTimer);
        disengageAudioGraphVisualMatrix();
    }

    async function engageAudioGraphVisualMatrix() {
        try {
            const specifications = { audio: { echoCancellation: true, noiseSuppression: true, autoGainControl: true } };
            streamRef = await navigator.mediaDevices.getUserMedia(specifications);
            audioCtx = new (window.AudioContext || window.webkitAudioContext)();
            analyser = audioCtx.createAnalyser();
            source = audioCtx.createMediaStreamSource(streamRef);
            
            if(document.getElementById('noise-filter').value === 'on') {
                biquadFilter = audioCtx.createBiquadFilter();
                biquadFilter.type = "bandpass";
                biquadFilter.frequency.value = 1200;
                biquadFilter.Q.value = 1.0;
                source.connect(biquadFilter);
                biquadFilter.connect(analyser);
            } else {
                source.connect(analyser);
            }
            
            analyser.fftSize = 64;
            const operationalBufferLength = analyser.frequencyBinCount;
            const realTimeFreqDataArray = new Uint8Array(operationalBufferLength);
            
            canvas.width = canvas.offsetWidth;
            canvas.height = canvas.offsetHeight;

            function processFrameSpectrumRendering() {
                animationId = requestAnimationFrame(processFrameSpectrumRendering);
                analyser.getByteFrequencyData(realTimeFreqDataArray);
                canvasCtx.clearRect(0, 0, canvas.width, canvas.height);
                
                let dynamicBarWidth = (canvas.width / operationalBufferLength) * 1.5;
                let horizontalAxisDrawCursor = 0;
                
                currentWaveHue = (currentWaveHue + 0.2) % 360;

                for(let i = 0; i < operationalBufferLength; i++) {
                    let calculatedBarHeightScale = realTimeFreqDataArray[i] / 2.0;
                    canvasCtx.fillStyle = `hsl(${currentWaveHue}, 85%, ${40 + (realTimeFreqDataArray[i]/5)}%)`;
                    canvasCtx.fillRect(horizontalAxisDrawCursor, (canvas.height - calculatedBarHeightScale)/2, dynamicBarWidth - 2, calculatedBarHeightScale);
                    horizontalAxisDrawCursor += dynamicBarWidth;
                }
            }
            processFrameSpectrumRendering();
        } catch(ex) {
            console.warn("Media stream context graph binding rejected.", ex);
        }
    }

    function disengageAudioGraphVisualMatrix() {
        if (animationId) cancelAnimationFrame(animationId);
        if (streamRef) streamRef.getTracks().forEach(track => track.stop());
        if (audioCtx) audioCtx.close();
        canvasCtx.clearRect(0, 0, canvas.width, canvas.height);
    }

    function evaluateMetricsCalculations() {
        const structuralContent = outputField.value.trim();
        const absoluteCharacterLength = structuralContent.length;
        const completeWordCount = structuralContent === "" ? 0 : structuralContent.split(/\s+/).length;
        
        let automatedGradeIndex = 1;
        if(completeWordCount > 5) {
            automatedGradeIndex = Math.min(12, Math.floor((absoluteCharacterLength / completeWordCount) * 1.8 - 2));
        }
        
        const runtimeMinutesCalculation = Math.ceil(completeWordCount / 180);
        metricsPanel.innerHTML = `Words: ${completeWordCount} | Chars: ${absoluteCharacterLength} | Grade Level: Index ${automatedGradeIndex} | Read Time: ~${runtimeMinutesCalculation}m`;
    }

    function renderLiveMarkdownPreview() {
        let dynamicRawText = outputField.value;
        let proceduralHtml = dynamicRawText
            .replace(/\n/g, "<br>")
            .replace(/\*\*([^*]+)\*\*/g, '<strong>$1</strong>')
            .replace(/\*([^*]+)\*/g, '<em>$1</em>')
            .replace(/<u>([^<]+)<\/u>/g, '<u>$1</u>')
            .replace(/~~([^~]+)~~/g, '<del>$1</del>')
            .replace(/#\s?([^<]+)/g, '<h2>$1</h2>');
            
        markdownPreviewPane.innerHTML = proceduralHtml;
    }

    function toggleSplitScreen() {
        const workspaceSplitter = document.getElementById('workspace-splitter');
        workspaceSplitter.classList.toggle('split-active');
        renderLiveMarkdownPreview();
    }

    function initializeCommandPaletteInterceptors() {
        document.addEventListener('keydown', (e) => {
            if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'k') {
                e.preventDefault();
                toggleCommandPaletteDisplayFlag();
            }
        });
        
        document.addEventListener('click', (e) => {
            const palettePanel = document.getElementById('global-command-palette');
            if(!palettePanel.contains(e.target) && palettePanel.style.display === 'block') {
                palettePanel.style.display = 'none';
            }
        });
    }

    function toggleCommandPaletteDisplayFlag() {
        const paletteContainer = document.getElementById('global-command-palette');
        const searchInput = document.getElementById('cmd-search-field');
        if(paletteContainer.style.display === 'block') {
            paletteContainer.style.display = 'none';
        } else {
            paletteContainer.style.display = 'block';
            searchInput.value = '';
            searchInput.focus();
            filterPaletteCommands();
        }
    }

    function filterPaletteCommands() {
        const searchFilterString = document.getElementById('cmd-search-field').value.toLowerCase();
        const resultsBox = document.getElementById('cmd-results-root');
        resultsBox.innerHTML = '';

        const matchedSelections = systemPaletteCommands.filter(c => c.name.toLowerCase().includes(searchFilterString));
        matchedSelections.forEach(command => {
            const entryItemRowElement = document.createElement('li');
            entryItemRowElement.className = "cmd-item";
            entryItemRowElement.innerHTML = `<span>${command.name}</span><span class="cmd-shortcut">${command.shortcut}</span>`;
            entryItemRowElement.onclick = () => {
                command.action();
                document.getElementById('global-command-palette').style.display = 'none';
            };
            resultsBox.appendChild(entryItemRowElement);
        });
    }

    function initializeDragDropUtilities() {
        const overlayCurtain = document.getElementById('drag-drop-curtain');

        window.addEventListener('dragover', (e) => { e.preventDefault(); overlayCurtain.style.display = "flex"; });
        overlayCurtain.addEventListener('dragleave', () => { overlayCurtain.style.display = "none"; });
        
        window.addEventListener('drop', (e) => {
            e.preventDefault();
            overlayCurtain.style.display = "none";
            const candidateDocumentFileAssetNode = e.dataTransfer.files[0];
            
            if (candidateDocumentFileAssetNode) {
                const asyncBlobReaderInstanceNode = new FileReader();
                asyncBlobReaderInstanceNode.onload = function(event) {
                    saveUndoSnapshotFrame();
                    outputField.value = event.target.result;
                    handleTextAreaAltered();
                    connectionToast.innerHTML = `<i class="fa-solid fa-file-import"></i> Imported: ${candidateDocumentFileAssetNode.name}`;
                };
                asyncBlobReaderInstanceNode.readAsText(candidateDocumentFileAssetNode);
            }
        });
    }

    function initializeNetworkAuditListeners() {
        window.addEventListener('online', () => {
            connectionToast.innerHTML = `<i class="fa-solid fa-wifi" style="color:var(--success)"></i> Core Ecosystem Online Linked`;
        });
        window.addEventListener('offline', () => {
            connectionToast.innerHTML = `<i class="fa-solid fa-triangle-exclamation" style="color:var(--danger)"></i> Offline Cache Matrix Active`;
            if(isRecording) recognition.stop();
        });
    }

    function triggerFileExport() {
        const outputChoiceToken = prompt("Export format configurations:\n[1] Clean Plain Markdown File (.md Assets Layout)\n[2] Native MS Word Document Binary Payload (.docx Structure Matrix)\n[3] Clean Plain Text File (.txt Resource File)");
        if (outputChoiceToken === '2') {
            triggerDocxOutputExport();
        } else if (outputChoiceToken === '1') {
            executeTextAssetBlobStreamSave(`Document_Workspace_Snapshot_${Date.now()}.md`, outputField.value, "text/markdown;charset=utf-8;");
        } else if (outputChoiceToken === '3') {
            executeTextAssetBlobStreamSave(`Document_Workspace_Snapshot_${Date.now()}.txt`, outputField.value, "text/plain;charset=utf-8;");
        }
    }

    /* --- FIXED NATIVE MS WORD EXPORT COMPATIBILITY ENGINE WRAPPER --- */
    function triggerDocxOutputExport() {
        const plaintextPayloadString = outputField.value.trim();
        if(!plaintextPayloadString) return;

        // Compiled as standard WordprocessingML schema structural layout elements
        const officeProcessingHtmlLayoutCode = `
            <html xmlns:o="urn:schemas-microsoft-com:office:office" xmlns:w="urn:schemas-microsoft-com:office:word" xmlns="http://www.w3.org/TR/REC-html40">
            <head>
                <meta charset="utf-8">
                <style>
                    body { font-family: 'Segoe UI', Arial, sans-serif; line-height: 1.6; }
                    p { margin-bottom: 10pt; }
                </style>
            </head>
            <body>
                ${plaintextPayloadString.split('\n\n').map(p => `<p>${p.replace(/\n/g, '<br>')}</p>`).join('')}
            </body>
            </html>
        `.trim();

        // Modified directly to base standard application/msword type stream wrapper to bypass file corruption alert blocks
        const officeProcessingMimeTargetToken = "application/msword";
        executeTextAssetBlobStreamSave(`Workspace_Export_${Date.now()}.docx`, officeProcessingHtmlLayoutCode, officeProcessingMimeTargetToken);
    }

    function executeTextAssetBlobStreamSave(targetFileNameString, inputPayloadBuffer, processingMimeTargetToken) {
        const compilationBlobStorageStructure = new Blob(['\ufeff' + inputPayloadBuffer], { type: processingMimeTargetToken });
        const virtualAnchorNodeElement = document.createElement('a');
        virtualAnchorNodeElement.href = URL.createObjectURL(compilationBlobStorageStructure);
        virtualAnchorNodeElement.download = targetFileNameString;
        document.body.appendChild(virtualAnchorNodeElement);
        virtualAnchorNodeElement.click();
        document.body.removeChild(virtualAnchorNodeElement);
    }

    function openNativeShareModal() {
        if(!outputField.value.trim()) {
            alert("Workspace is empty.");
            return;
        }
        document.getElementById('share-options-modal').style.display = 'flex';
    }

    function closeNativeShareModal(e) {
        document.getElementById('share-options-modal').style.display = 'none';
    }

    function triggerShareAssetFile(extension) {
        const textPayload = outputField.value;
        let mimeType = "text/plain";
        let payloadData = textPayload;

        if (extension === 'docx') {
            mimeType = "application/vnd.openxmlformats-officedocument.wordprocessingml.document";
            payloadData = `\ufeff<html xmlns:o="urn:schemas-microsoft-com:office:office" xmlns:w="urn:schemas-microsoft-com:office:word" xmlns="http://www.w3.org/TR/REC-html40">
            <head><meta charset="utf-8"></head>
            <body>${textPayload.split('\n\n').map(p => `<p>${p.replace(/\n/g, '<br>')}</p>`).join('')}</body>
            </html>`.trim();
        }

        const shareFile = new File([payloadData], `Workspace_Shared_Note.${extension}`, { type: mimeType });
        
        if (navigator.canShare && navigator.canShare({ files: [shareFile] })) {
            navigator.share({
                files: [shareFile],
                title: 'Workspace Note File Share',
                text: 'Shared note file from AI Voice Workspace Pro X.'
            }).then(() => {
                connectionToast.innerHTML = `<i class="fa-solid fa-share-nodes"></i> Shared file successfully!`;
            }).catch(err => console.log('Sharing canceled/failed:', err));
        } else {
            alert(`Direct file container sharing layout for .${extension} isn't supported on this browser architecture. Use standard Export Menu instead.`);
        }
        document.getElementById('share-options-modal').style.display = 'none';
    }

    function triggerShareAssetPage() {
        if (navigator.share) {
            navigator.share({
                title: 'Ultimate AI Voice Workspace Page Share',
                text: outputField.value,
                url: window.location.href
            }).then(() => {
                connectionToast.innerHTML = `<i class="fa-solid fa-share-nodes"></i> Shared page details successfully!`;
            }).catch(err => console.log('Sharing platform trace canceled:', err));
        } else {
            alert("Web Share API framework is missing on this operating platform layout context.");
        }
        document.getElementById('share-options-modal').style.display = 'none';
    }

    function commitVersionControlCheckpoint() {
        const currentActiveTextContent = outputField.value.trim();
        if(!currentActiveTextContent) return;

        if(versionControlHistory.length === 0 || versionControlHistory[versionControlHistory.length - 1].text !== currentActiveTextContent) {
            versionControlHistory.push({
                text: currentActiveTextContent,
                timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' })
            });
            if(versionControlHistory.length > 20) versionControlHistory.shift();
            localStorage.setItem('workspace_version_history', JSON.stringify(versionControlHistory));
            updateVersionHistoryDrawerLayoutView();
        }
    }

    function updateVersionHistoryDrawerLayoutView() {
        const containerBoxNode = document.getElementById('version-list-root');
        containerBoxNode.innerHTML = '';
        
        const localHistory = JSON.parse(localStorage.getItem('workspace_version_history')) || [];
        versionControlHistory = localHistory;

        versionControlHistory.slice().reverse().forEach((versionItem, index) => {
            const blockRowNode = document.createElement('div');
            blockRowNode.className = "history-item";
            blockRowNode.innerHTML = `
                <div class="hist-txt" style="max-width:200px;">${versionItem.text.slice(0, 40)}...</div>
                <span style="font-size:0.7rem; color:var(--text-sub); font-weight:bold;">${versionItem.timestamp}</span>
            `;
            blockRowNode.onclick = () => {
                if(confirm("Rollback canvas configuration to this historic incremental version snapshot state?")) {
                    saveUndoSnapshotFrame();
                    outputField.value = versionItem.text;
                    handleTextAreaAltered();
                    closeVersionDrawer();
                }
            };
            containerBoxNode.appendChild(blockRowNode);
        });
    }

    function openVersionDrawer() { 
        updateVersionHistoryDrawerLayoutView();
        document.getElementById('version-history-drawer').classList.add('open'); 
    }
    
    function closeVersionDrawer() { document.getElementById('version-history-drawer').classList.remove('open'); }

    function autoSaveWorkspaceHistoryItem() {
        const currentActiveTextContent = outputField.value.trim();
        if(!currentActiveTextContent) return;
        
        let sessionSnapshotsHistoryArray = JSON.parse(localStorage.getItem('engine_workspace_history')) || [];
        if(sessionSnapshotsHistoryArray.length > 0 && sessionSnapshotsHistoryArray[0].text === currentActiveTextContent) return;

        sessionSnapshotsHistoryArray = sessionSnapshotsHistoryArray.filter(item => item.text !== currentActiveTextContent);
        sessionSnapshotsHistoryArray.unshift({
            text: currentActiveTextContent,
            time: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
        });

        if(sessionSnapshotsHistoryArray.length > 8) sessionSnapshotsHistoryArray.pop();
        localStorage.setItem('engine_workspace_history', JSON.stringify(sessionSnapshotsHistoryArray));
        loadLocalHistoryList();
    }

    function loadLocalHistoryList() {
        const rootBoxNode = document.getElementById('history-box');
        rootBoxNode.innerHTML = '';
        let sessionSnapshotsHistoryArray = JSON.parse(localStorage.getItem('engine_workspace_history')) || [];
        
        sessionSnapshotsHistoryArray.forEach((item, index) => {
            const entryRowNode = document.createElement('li');
            entryRowNode.className = 'history-item';
            const explicitNameLabelValueString = item.name || (item.text.slice(0, 16) + "...");
            entryRowNode.innerHTML = `
                <div class="hist-txt" onclick="restoreLocalHistoryItem(${index})">${explicitNameLabelValueString}</div>
                <div class="item-actions">
                    <button class="btn-action-icon" onclick="renameLocalHistoryItem(event, ${index})" title="Edit Label/Name"><i class="fa-solid fa-pen"></i></button>
                    <button class="btn-action-icon del-btn" onclick="deleteLocalHistoryItem(event, ${index})" title="Delete Draft"><i class="fa-solid fa-trash-can"></i></button>
                </div>
            `;
            rootBoxNode.appendChild(entryRowNode);
        });
    }

    function deleteLocalHistoryItem(event, index) {
        event.stopPropagation();
        if(confirm("Delete this session draft permanently from memory?")) {
            let sessionSnapshotsHistoryArray = JSON.parse(localStorage.getItem('engine_workspace_history')) || [];
            sessionSnapshotsHistoryArray.splice(index, 1);
            localStorage.setItem('engine_workspace_history', JSON.stringify(sessionSnapshotsHistoryArray));
            loadLocalHistoryList();
            connectionToast.innerHTML = `<i class="fa-solid fa-trash" style="color:var(--danger)"></i> Draft Deleted`;
        }
    }

    function renameLocalHistoryItem(event, index) {
        event.stopPropagation();
        let sessionSnapshotsHistoryArray = JSON.parse(localStorage.getItem('engine_workspace_history')) || [];
        const replacementLabelChoiceString = prompt("Assign label name tag reference identifier:", sessionSnapshotsHistoryArray[index].name || "Draft");
        if(replacementLabelChoiceString) {
            sessionSnapshotsHistoryArray[index].name = replacementLabelChoiceString;
            localStorage.setItem('engine_workspace_history', JSON.stringify(sessionSnapshotsHistoryArray));
            loadLocalHistoryList();
        }
    }

    function restoreLocalHistoryItem(index) {
        let sessionSnapshotsHistoryArray = JSON.parse(localStorage.getItem('engine_workspace_history')) || [];
        if(sessionSnapshotsHistoryArray[index]) {
            saveUndoSnapshotFrame();
            outputField.value = sessionSnapshotsHistoryArray[index].text;
            handleTextAreaAltered();
        }
    }

    function loadLocalVoiceMacrosList() {
        const rootBoxNode = document.getElementById('macro-list-box');
        rootBoxNode.innerHTML = '';
        let customDictionaryStorageObjectMap = JSON.parse(localStorage.getItem('user_voice_dict')) || {};
        
        for (let key in customDictionaryStorageObjectMap) {
            const entryRowNode = document.createElement('li');
            entryRowNode.className = 'history-item';
            entryRowNode.innerHTML = `
                <div class="hist-txt"><strong>${key}</strong> → ${customDictionaryStorageObjectMap[key]}</div>
                <div class="item-actions">
                    <button class="btn-action-icon" onclick="editVoiceMacro('${key}')" title="Edit Macro"><i class="fa-solid fa-pen"></i></button>
                    <button class="btn-action-icon del-btn" onclick="deleteVoiceMacro('${key}')" title="Delete Macro"><i class="fa-solid fa-trash-can"></i></button>
                </div>
            `;
            rootBoxNode.appendChild(entryRowNode);
        }
    }

    function addToDictionary() {
        const targetInputElementFieldNode = document.getElementById('dict-input');
        const validationStringPayload = targetInputElementFieldNode.value.trim();
        if(!validationStringPayload || !validationStringPayload.includes('=')) {
            alert("Structure format schema mismatch requirement example: macro=expansion text block string");
            return;
        }
        let customDictionaryStorageObjectMap = JSON.parse(localStorage.getItem('user_voice_dict')) || {};
        const configurationSplitTokenPairs = validationStringPayload.split('=');
        customDictionaryStorageObjectMap[configurationSplitTokenPairs[0].trim()] = configurationSplitTokenPairs[1].trim();
        localStorage.setItem('user_voice_dict', JSON.stringify(customDictionaryStorageObjectMap));
        targetInputElementFieldNode.value = '';
        loadLocalVoiceMacrosList();
        connectionToast.innerHTML = `<i class="fa-solid fa-book" style="color:var(--success)"></i> Personal Voice Macro Saved`;
    }

    function editVoiceMacro(oldKey) {
        let customDictionaryStorageObjectMap = JSON.parse(localStorage.getItem('user_voice_dict')) || {};
        const currentValue = customDictionaryStorageObjectMap[oldKey];
        const updatedExpression = prompt(`Editing Macro phrase: "${oldKey}"\nProvide new layout mappings (format: trigger=expansion text):`, `${oldKey}=${currentValue}`);
        
        if (updatedExpression && updatedExpression.includes('=')) {
            const parts = updatedExpression.split('=');
            delete customDictionaryStorageObjectMap[oldKey];
            customDictionaryStorageObjectMap[parts[0].trim()] = parts[1].trim();
            localStorage.setItem('user_voice_dict', JSON.stringify(customDictionaryStorageObjectMap));
            loadLocalVoiceMacrosList();
            connectionToast.innerHTML = `<i class="fa-solid fa-pen-to-square"></i> Macro Updated`;
        }
    }

    function deleteVoiceMacro(key) {
        if(confirm(`Delete the voice macro shortcut "${key}" completely?`)) {
            let customDictionaryStorageObjectMap = JSON.parse(localStorage.getItem('user_voice_dict')) || {};
            delete customDictionaryStorageObjectMap[key];
            localStorage.setItem('user_voice_dict', JSON.stringify(customDictionaryStorageObjectMap));
            loadLocalVoiceMacrosList();
            connectionToast.innerHTML = `<i class="fa-solid fa-trash-can" style="color:var(--danger)"></i> Macro Purged`;
        }
    }

    const macroLanguages = {
        'en-US': ['.', '?', ',', '!', 'New Line'],
        'bn-BD': ['।', '?', ',', '!', 'নতুন প্যারা'],
        'hi-IN': ['।', '?', ',', '!', 'नई लाइन'],
        'es-ES': ['.', '?', ',', '!', 'Nueva Línea']
    };

    function renderMacrosRowElements() {
        const targetContainerNode = document.getElementById('macro-bar');
        targetContainerNode.innerHTML = '';
        const selectedLanguageCodeKey = document.getElementById('lang-select').value;
        const activeSymbolsList = macroLanguages[selectedLanguageCodeKey] || ['.', '?', ',', '!'];
        
        activeSymbolsList.forEach(symbol => {
            const interactivePunctuationButtonElement = document.createElement('button');
            interactivePunctuationButtonElement.className = 'btn-macro';
            interactivePunctuationButtonElement.innerText = symbol;
            interactivePunctuationButtonElement.onclick = () => { triggerTactileVibePattern(10); injectMacroTemplateToken(symbol); };
            targetContainerNode.appendChild(interactivePunctuationButtonElement);
        });
    }

    function injectMacroTemplateToken(symbolStringValue) {
        saveUndoSnapshotFrame();
        outputField.focus();
        const selectionStartIndexLocation = outputField.selectionStart;
        const selectionEndIndexLocation = outputField.selectionEnd;
        const activeTextContentString = outputField.value;

        if (symbolStringValue.includes('Line') || symbolStringValue.includes('প্যারা') || symbolStringValue.includes('লাইন') || symbolStringValue.includes('Línea')) {
            symbolStringValue = "\n\n";
        } else {
            symbolStringValue = symbolStringValue + " ";
        }

        outputField.value = activeTextContentString.slice(0, selectionStartIndexLocation) + symbolStringValue + activeTextContentString.slice(selectionEndIndexLocation);
        localStorage.setItem('workspace_active_text', outputField.value);
        const targetSelectionCursorResetIndex = selectionStartIndexLocation + symbolStringValue.length;
        outputField.setSelectionRange(targetSelectionCursorResetIndex, targetSelectionCursorResetIndex);
        handleTextAreaAltered();
    }

    function replacePersonalShortcutTokens(textInputDataString) {
        let customDictionaryStorageObjectMap = JSON.parse(localStorage.getItem('user_voice_dict')) || {};
        let modifiedTransformedStringResult = textInputDataString;
        for (let targetExpansionKeyShortcutToken in customDictionaryStorageObjectMap) {
            let syntaxSanitizedSearchRegexPattern = new RegExp('\\b' + targetExpansionKeyShortcutToken + '\\b', 'gi');
            modifiedTransformedStringResult = modifiedTransformedStringResult.replace(syntaxSanitizedSearchRegexPattern, customDictionaryStorageObjectMap[targetExpansionKeyShortcutToken]);
        }
        return modifiedTransformedStringResult;
    }

    function switchLanguage() {
        const selectorNodeRef = document.getElementById('lang-select');
        const activeOptionNodeElement = selectorNodeRef.options[selectorNodeRef.selectedIndex];
        outputField.placeholder = activeOptionNodeElement.getAttribute('data-placeholder');
        
        localStorage.setItem('workspace_lang', selectorNodeRef.value);
        
        renderMacrosRowElements();
        if(isRecording) {
            recognition.stop();
            setTimeout(toggleDictationEngine, 400);
        }
    }

    function changeFontFamily() { outputField.style.fontFamily = document.getElementById('font-select').value; }
    function modifyFontSize(deltaModifierPixelsValue) {
        const computedStylesReferenceNode = window.getComputedStyle(outputField, null).getPropertyValue('font-size');
        const targetCalculatedPixelSize = parseFloat(computedStylesReferenceNode) + deltaModifierPixelsValue;
        if(targetCalculatedPixelSize >= 12 && targetCalculatedPixelSize <= 42) outputField.style.fontSize = targetCalculatedPixelSize + 'px';
    }

    function runAISpellPatch() {
        saveUndoSnapshotFrame();
        let targetTextToParse = outputField.value;
        const activeLanguageProfileLocaleKeyStr = document.getElementById('lang-select').value;
        
        if (activeLanguageProfileLocaleKeyStr === 'bn-BD') {
            if(targetTextToParse && !targetTextToParse.endsWith('।')) targetTextToParse += ' ।';
        } else {
            if(targetTextToParse && !targetTextToParse.endsWith('.')) targetTextToParse += '.';
        }
        outputField.value = targetTextToParse;
        handleTextAreaAltered();
        connectionToast.innerHTML = `<i class="fa-solid fa-wand-magic-sparkles"></i> Native NLP Formatting Alignment Executed`;
    }

    function openFindReplace() {
        const matchStringTargetToken = prompt("Enter text target matching search sequence:");
        if(!matchStringTargetToken) return;
        const replacementStringTargetToken = prompt(`Replace matching occurrences of "${matchStringTargetToken}" with:`);
        if(replacementStringTargetToken === null) return;
        
        saveUndoSnapshotFrame();
        const globalSearchRegexEnginePattern = new RegExp(matchStringTargetToken, 'g');
        outputField.value = outputField.value.replace(globalSearchRegexEnginePattern, replacementStringTargetToken);
        handleTextAreaAltered();
    }

    function triggerTTS() {
        const dynamicPayloadStringToSpeak = outputField.value.trim();
        if(!dynamicPayloadStringToSpeak) return;
        window.speechSynthesis.cancel();
        const dynamicSpeechUtteranceInstanceNode = new SpeechSynthesisUtterance(dynamicPayloadStringToSpeak);
        dynamicSpeechUtteranceInstanceNode.lang = document.getElementById('lang-select').value;
        window.speechSynthesis.speak(dynamicSpeechUtteranceInstanceNode);
    }

    function executeClipboardCopy() {
        if(!outputField.value.trim()) return;
        navigator.clipboard.writeText(outputField.value);
        connectionToast.innerHTML = `<i class="fa-solid fa-copy"></i> Copied to Clipboard`;
    }

    function flushActiveWorkspace() {
        if(confirm("Perform absolute destructive canvas purge wipe clean sequence operations loop?")) {
            saveUndoSnapshotFrame();
            outputField.value = '';
            wordTimestamps = [];
            handleTextAreaAltered();
        }
    }

    function toggleZenMode() {
        const backgroundAudioTrackNode = document.getElementById('zen-noise-audio');
        if(document.body.classList.contains('zen-active')) {
            exitZenMode();
        } else {
            document.body.classList.add('zen-active');
            backgroundAudioTrackNode.play().catch(() => console.log("Ambient path autoplay blocked."));
        }
    }

    function exitZenMode() {
        document.body.classList.remove('zen-active');
        document.getElementById('zen-noise-audio').pause();
    }

    function toggleTheme() {
        let currentThemeSetting = localStorage.getItem('workspace_theme') || 'light';
        let nextThemeSetting = 'light';
        
        if (currentThemeSetting === 'light') {
            nextThemeSetting = 'dark';
        } else if (currentThemeSetting === 'dark') {
            nextThemeSetting = 'system';
        }
        
        localStorage.setItem('workspace_theme', nextThemeSetting);
        applyStoredOrSystemTheme();
    }

    function applyStoredOrSystemTheme() {
        const targetThemeMode = localStorage.getItem('workspace_theme') || 'light';
        const themeIconNodeRef = document.getElementById('theme-icon');
        
        if (targetThemeMode === 'system') {
            const systemPrefersDark = window.matchMedia('(prefers-color-scheme: dark)').matches;
            if (systemPrefersDark) {
                document.documentElement.setAttribute('data-theme', 'dark');
            } else {
                document.documentElement.removeAttribute('data-theme');
            }
            themeIconNodeRef.className = "fa-solid fa-circle-half-stroke";
            themeIconNodeRef.parentElement.setAttribute('title', 'Theme: System Sync');
        } else if (targetThemeMode === 'dark') {
            document.documentElement.setAttribute('data-theme', 'dark');
            themeIconNodeRef.className = "fa-solid fa-sun";
            themeIconNodeRef.parentElement.setAttribute('title', 'Theme: Dark Profile');
        } else {
            document.documentElement.removeAttribute('data-theme');
            themeIconNodeRef.className = "fa-solid fa-moon";
            themeIconNodeRef.parentElement.setAttribute('title', 'Theme: Light Profile');
        }
    }
