// script.js

document.addEventListener("DOMContentLoaded", function() {
    // =============================
    // DOM要素の取得
    // =============================
    const instructionContainer = document.getElementById('instructionContainer');
    const startTestButton = document.getElementById('startTestButton');
    const userForm = document.getElementById('userForm');
    const submitButton = document.getElementById('submitButton');
    const usernameInput = document.getElementById('username');
    const wakeStatusInputs = document.getElementsByName('wakeStatus');
    const letterContainer = document.getElementById('letterContainer');
    const buttonsContainer = document.getElementById('buttonsContainer');
    const trialCounter = document.getElementById('trialCounter');
    const loadingIndicator = document.getElementById('loadingIndicator');
    
    // デバッグコンテナの要素を取得
    const debugContainer = document.getElementById('debugContainer');
    const layoutsList = document.getElementById('layoutsList');
    const blocksList = document.getElementById('blocksList');
    const exportCSVButton = document.getElementById('exportCSVButton');
    
    // =============================
    // 状態管理変数の初期化
    // =============================
    let username = '';
    let wakeStatus = '';
    let startTime = 0;
    
    let repeatedLayouts = []; // 反復配置の10レイアウト
    let randomLayouts = [];   // ランダム配置の10レイアウト
    let allLayouts = [];      // 全ブロックで使用されるシャッフルされたレイアウト（18ブロック × 20レイアウト = 360トライアル）
    let trialCount = 0;       // 現在のトライアル番号（0〜359）
    let results = [];         // ユーザーの応答結果を格納
    
    let isExperimentStarted = false; // 実験が開始されたかどうかのフラグ
    let isExperimentEnded = false;   // 実験が終了したかどうかのフラグ
    
    // =============================
    // デバッグモードの検出
    // =============================
    const urlParams = new URLSearchParams(window.location.search);
    const isDebugMode = urlParams.get('debug') === 'true';
    
    // =============================
    // レイアウト生成関数
    // =============================

    /**
     * 反復配置とランダム配置の10種類ずつ、計20種類のレイアウトを生成する
     * 反復配置: 1〜10
     * ランダム配置: A〜J
     * 各レイアウトに固有のlayoutIdを割り当てる
     * @param {number} containerSize - レイアウトを配置するコンテナのサイズ（幅または高さ）
     */
    function generateLayouts(containerSize) {
        // 反復配置のレイアウト生成
        for (let i = 1; i <= 10; i++) {
            const layoutId = i.toString(); // 1〜10
            const tPosition = generateFixedTPosition(containerSize);
            const layoutItems = generateFixedLayout(tPosition, containerSize, 'repeated', layoutId);
            
            repeatedLayouts.push({
                layoutId: layoutId,
                items: layoutItems
            });
        }
        
        // ランダム配置のレイアウト生成
        for (let i = 0; i < 10; i++) {
            const layoutId = String.fromCharCode(65 + i); // A〜J
            const tPosition = generateFixedTPosition(containerSize);
            const tRotation = getRandomRotation(true);
            
            // 初期のランダム配置ではL字の位置はブロックごとに生成されるため、itemsは空配列
            randomLayouts.push({
                layoutId: layoutId,
                tPosition: tPosition,
                tRotation: tRotation,
                items: [] // 初期は空
            });
        }
    }

    /**
     * 固定されたTの位置を生成する関数
     * 各レイアウトでTの位置が固定される
     * @param {number} containerSize - レイアウトを配置するコンテナのサイズ
     * @returns {Object} Tの位置 { top: number, left: number }
     */
    function generateFixedTPosition(containerSize) {
        let position;
        let attempts = 0;
        const maxAttempts = 100;
        const minDistanceFromCenterLines = 15; // 50%からの最小距離（パーセンテージ）を15%に設定

        do {
            position = {
                top: getRandomPosition(10, 90),
                left: getRandomPosition(10, 90)
            };
            attempts++;
        } while (
            attempts < maxAttempts && (
                // 中央の十字マークおよび中央の縦横線から一定の距離を保つ
                (Math.abs(position.top - 50) < minDistanceFromCenterLines) ||
                (Math.abs(position.left - 50) < minDistanceFromCenterLines)
            )
        );

        if (attempts >= maxAttempts) {
            // 有効な位置が見つからない場合はデフォルト位置を設定
            position = { top: 10, left: 10 };
        }

        return position;
    }

    /**
     * 固定レイアウトのT字とL字を生成する関数
     * @param {Object} tPosition - Tの位置 { top: number, left: number }
     * @param {number} containerSize - コンテナのサイズ
     * @param {string} layoutType - 'repeated' または 'random'
     * @param {string} layoutId - レイアウトの識別子
     * @returns {Array} レイアウト内の文字情報の配列
     */
    function generateFixedLayout(tPosition, containerSize, layoutType, layoutId) {
        let layout = [];
        
        // T字を配置（回転角度は90度または270度のみ）
        layout.push({
            letter: 'T',
            rotation: getRandomRotation(true), // 90度または270度
            top: tPosition.top, // パーセンテージ
            left: tPosition.left, // パーセンテージ
            layoutType: layoutType, // レイアウトタイプ
            layoutId: layoutId // レイアウトID
        });
        
        // L字を配置
        const numLLetters = 11; // 各レイアウトに配置するL字の数
        for (let i = 0; i < numLLetters; i++) {
            let lPosition = generateLPosition(tPosition, containerSize, layoutType, layout);
            let rotation = getRandomRotation();
            
            layout.push({
                letter: 'L',
                rotation: rotation,
                top: lPosition.top,
                left: lPosition.left,
                layoutType: layoutType,
                layoutId: layoutId
            });
        }
        
        return layout;
    }

    /**
     * L字の位置を生成する関数
     * 各レイアウト内でL字がクロスヘアや他のL字と重複しないように配置
     * @param {Object} tPosition - Tの位置 { top: number, left: number }
     * @param {number} containerSize - レイアウトを配置するコンテナのサイズ
     * @param {string} layoutType - 'repeated' または 'random'
     * @param {Array} currentLayout - 現在のレイアウト配列
     * @returns {Object} Lの位置 { top: number, left: number }
     */
    function generateLPosition(tPosition, containerSize, layoutType, currentLayout) {
        let position;
        let attempts = 0;
        let isValid = false;
        const maxAttempts = 100;
        const minDistanceFromCenterLines = 10; // 50%からの最小距離（パーセンテージ）を15%に設定

        while (!isValid && attempts < maxAttempts) {
            position = {
                top: getRandomPosition(10, 90), // 10%〜90%の範囲内
                left: getRandomPosition(10, 90) // 10%〜90%の範囲内
            };

            // 中央の十字マークおよび中央の縦横線から一定の距離を保つ
            if (Math.abs(position.top - 50) < minDistanceFromCenterLines || Math.abs(position.left - 50) < minDistanceFromCenterLines) {
                attempts++;
                continue;
            }

            // T字との重複を避ける
            if (Math.abs(position.top - tPosition.top) < 10 && Math.abs(position.left - tPosition.left) < 10) {
                attempts++;
                continue;
            }

            // 既存のL字との重複を避ける
            const overlapping = currentLayout.some(item => {
                if (item.letter !== 'L') return false;
                const distanceTop = Math.abs(item.top - position.top);
                const distanceLeft = Math.abs(item.left - position.left);
                return (distanceTop < 10) && (distanceLeft < 10); // 10%以内の距離であれば重複とみなす
            });

            if (overlapping) {
                attempts++;
                continue;
            }

            isValid = true;
        }

        if (isValid) {
            return position;
        } else {
            // 有効な位置が見つからない場合はデフォルト位置を設定
            return { top: 10, left: 10 };
        }
    }

    /**
     * ランダムな回転角度を取得する関数
     * @param {boolean} isT - T字の場合はtrue、L字の場合はfalse
     * @returns {number} 回転角度（度）
     */
    function getRandomRotation(isT = false) {
        if (isT) {
            const rotations = [90, 270];
            const index = Math.floor(Math.random() * rotations.length);
            return rotations[index];
        } else {
            const rotations = [0, 90, 180, 270];
            const index = Math.floor(Math.random() * rotations.length);
            return rotations[index];
        }
    }
    
    /**
     * ランダムな位置を取得する関数
     * @param {number} min - 最小値（パーセンテージ）
     * @param {number} max - 最大値（パーセンテージ）
     * @returns {number} ランダムな位置（パーセンテージ）
     */
    function getRandomPosition(min, max) {
        return Math.random() * (max - min) + min;
    }
    
    /**
     * レイアウト配列をシャッフルする関数
     * @param {Array} array - シャッフル対象の配列
     * @returns {Array} シャッフルされた配列
     */
    function shuffleArray(array) {
        for (let i = array.length - 1; i > 0; i--) {
            const j = Math.floor(Math.random() * (i + 1));
            [array[i], array[j]] = [array[j], array[i]];
        }
        return array;
    }
    
    // =============================
    // レイアウト初期化関数
    // =============================
    
    /**
     * 全ブロックに対してシャッフルされたレイアウトを初期化する関数
     * 反復配置は固定、ランダム配置はブロックごとにL字位置をランダムに生成
     */
    function initializeAllLayouts() {
        const containerSize = Math.min(letterContainer.clientWidth, letterContainer.clientHeight);
        generateLayouts(containerSize); // 反復配置10種類とランダム配置10種類のレイアウトを生成
        
        const numberOfBlocks = 18;
        const layoutsPerBlock = 20;
        
        for (let block = 0; block < numberOfBlocks; block++) {
            let blockLayouts = [];
            
            // ランダム配置のレイアウトのL字位置をブロックごとに生成
            randomLayouts.forEach(randomLayout => {
                const layoutId = randomLayout.layoutId;
                const tPosition = randomLayout.tPosition;
                const tRotation = randomLayout.tRotation;
                
                // 新しいL字位置を生成
                let layoutItems = generateFixedLayout(tPosition, containerSize, 'random', layoutId);
                
                blockLayouts.push({
                    layoutId: layoutId,
                    items: layoutItems
                });
            });
            
            // 反復配置のレイアウトを追加（固定）
            repeatedLayouts.forEach(repeatedLayout => {
                blockLayouts.push(repeatedLayout);
            });
            
            // レイアウトをシャッフル
            let shuffledBlockLayouts = shuffleArray([...blockLayouts]);
            allLayouts.push(...shuffledBlockLayouts); // allLayoutsに追加
            
            // デバッグモード時に各ブロックのシャッフル結果を表示
            if (isDebugMode) {
                console.log(`Block ${block + 1} Layouts:`, shuffledBlockLayouts);
                displayBlockLayouts(block + 1, shuffledBlockLayouts);
            }
        }
        
        // デバッグモード時にPredefined Layoutsを表示
        if (isDebugMode) {
            displayPredefinedLayouts();
            console.log('All Layouts:', allLayouts);
        }
    }
    
    // =============================
    // レイアウト表示関数
    // =============================
    
    /**
     * 現在のレイアウトを表示する関数
     * @param {Object} layout - 現在のレイアウトオブジェクト { layoutId: string, items: Array }
     */
    function displayLetters(layout) {
        // 既存の文字アイテムを削除
        const existingLetters = letterContainer.querySelectorAll('.letter-item');
        existingLetters.forEach(item => item.remove());
        
        // 新たに文字アイテムを作成
        layout.items.forEach(item => {
            if (item.letter === '') return; // 空文字の場合はスキップ
            
            const letterDiv = document.createElement('div');
            letterDiv.classList.add('letter-item');
            letterDiv.textContent = item.letter;
            letterDiv.style.top = `${item.top}%`;
            letterDiv.style.left = `${item.left}%`;
            letterDiv.style.transform = `rotate(${item.rotation}deg)`;
            if (item.letter === 'T') {
                letterDiv.style.color = 'black';
            }
            letterContainer.appendChild(letterDiv);
        });
    }
    
    // =============================
    // 実験開始関数
    // =============================
    
    /**
     * 実験を開始する関数
     */
    function startExperiment() {
        isExperimentStarted = true;
        isExperimentEnded = false;
        trialCount = 0;
        results = [];
        startTime = Date.now(); // 実験開始時刻を記録
        nextTrial();
    }
    
    /**
     * 次のトライアルを実行する関数
     */
    function nextTrial() {
        if (trialCount < allLayouts.length) {
            const currentBlock = Math.floor(trialCount / 20) + 1;
            const currentLayoutNumber = (trialCount % 20) + 1;
            trialCounter.textContent = `ブロック: ${currentBlock} / 18 | レイアウト: ${currentLayoutNumber} / 20`;
            
            const currentLayout = allLayouts[trialCount];
            displayLetters(currentLayout);
            letterContainer.style.visibility = 'visible';
            buttonsContainer.style.display = 'flex';
            
            trialStartTime = Date.now(); // トライアル開始時刻を記録
            trialCount++;
        } else {
            endExperiment(); // 実験終了
        }
    }
    
    // =============================
    // ユーザー応答処理関数
    // =============================
    
    /**
     * ユーザーの応答をチェックし、結果を記録する関数
     * @param {string} response - ユーザーの応答 ('left' または 'right')
     */
    function checkResponse(response) {
        if (!isExperimentStarted || isExperimentEnded) return;
        
        const endTime = Date.now();
        const reactionTime = endTime - trialStartTime; // 反応時間を計算
        
        // 現在のレイアウトからTの回転角度を取得
        const currentLayout = allLayouts[trialCount - 1];
        const targetItem = currentLayout.items.find(item => item.letter === 'T');
        const targetRotation = targetItem ? targetItem.rotation : 0;
        const layoutType = targetItem ? targetItem.layoutType : 'unknown';
        const layoutId = targetItem ? targetItem.layoutId : 'unknown';
        
        // 正誤判定
        const isCorrect = (response === 'left' && targetRotation === 270) || (response === 'right' && targetRotation === 90);
        
        // 結果を記録
        results.push({
            participant: username,
            condition: wakeStatus,
            testType: 'Implicit Learning',
            trialNumber: `${trialCount}`,
            layoutId: layoutId, // layoutIdを記録
            layoutType: layoutType,
            result: isCorrect ? 'Correct' : 'Incorrect',
            responseTime: `${reactionTime}`
        });
        
        // フィードバックの表示
        displayFeedback(isCorrect);
        
        // デバッグモード時に結果をコンソールに表示
        if (isDebugMode) {
            console.log(`Trial ${trialCount}: Response=${response}, Rotation=${targetRotation}, Correct=${isCorrect}`);
        }
        
        // 次のトライアルへ進む準備
        letterContainer.style.visibility = 'hidden';
        buttonsContainer.style.display = 'none';
        setTimeout(nextTrial, 300); // 次のトライアルに進む前に300msの遅延
    }
    
    /**
     * フィードバックを表示する関数
     * @param {boolean} isCorrect - 正解かどうか
     */
    function displayFeedback(isCorrect) {
        const feedback = document.createElement('div');
        feedback.classList.add('feedback');
        feedback.textContent = isCorrect ? '正解！' : '不正解。';
        feedback.style.position = 'absolute';
        feedback.style.bottom = '10px';
        feedback.style.left = '50%';
        feedback.style.transform = 'translateX(-50%)';
        feedback.style.padding = '10px 20px';
        feedback.style.backgroundColor = isCorrect ? 'rgba(40, 167, 69, 0.8)' : 'rgba(220, 53, 69, 0.8)';
        feedback.style.color = '#fff';
        feedback.style.borderRadius = '5px';
        feedback.style.fontSize = '1rem';
        feedback.style.animation = 'fadeOut 1s forwards';
        
        letterContainer.appendChild(feedback);
        
        // フィードバックをアニメーションでフェードアウト
        setTimeout(() => {
            feedback.remove();
        }, 1000); // 1秒後にフィードバックを削除
    }
    
    // =============================
    // 実験終了関数
    // =============================
    
    /**
     * 実験を終了する関数
     */
    function endExperiment() {
        isExperimentEnded = true;
        isExperimentStarted = false;
        
        // テストエリアおよびボタンエリアを非表示
        letterContainer.style.display = 'none';
        buttonsContainer.style.display = 'none';
        trialCounter.style.display = 'none';
        
        // ユーザーフォームを表示
        userForm.style.display = 'block';
        
        // デバッグモード時に結果をコンソールに表示
        if (isDebugMode) {
            console.log('Experiment Ended. Results:', results);
        }
    }
    
    // =============================
    // 結果送信関数
    // =============================
    
    /**
     * 結果をサーバーに送信する関数
     */
    function sendResultsToServer() {
        const data = {
            participant: username,
            condition: wakeStatus,
            testType: 'Implicit Learning',
            results: results
        };
        
        // ローディングインジケーターの表示
        loadingIndicator.style.display = 'flex';
        
        fetch('http://localhost:3000/proxy', { // サーバーのエンドポイントに合わせてURLを変更
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify(data)
        })
        .then(response => {
            loadingIndicator.style.display = 'none'; // ローディングインジケーターを非表示
            if (!response.ok) {
                throw new Error(`HTTP error! Status: ${response.status}`);
            }
            return response.json();
        })
        .then(data => {
            console.log('成功:', data);
            displayThankYouMessage(); // 結果送信後にメッセージを表示
        })
        .catch(error => {
            loadingIndicator.style.display = 'none'; // ローディングインジケーターを非表示
            console.error('エラー:', error);
            alert('結果の送信に失敗しました。後ほど再試行してください。');
            // エラー時のUIを再表示
            userForm.style.display = 'block';
        });
    }
    
    /**
     * 結果送信後のメッセージを表示する関数
     */
    function displayThankYouMessage() {
        const resultContainer = document.createElement('div');
        resultContainer.classList.add('result-container');
        const totalCorrect = calculateTotalCorrect();
        resultContainer.innerHTML = `
            <p>結果は送信されました。回答ありがとうございます。</p>
            <p>総正解数: ${totalCorrect} / ${allLayouts.length}</p>
        `;
        document.body.innerHTML = ''; // 既存の要素をクリア
        document.body.appendChild(resultContainer); // メッセージを表示
    }
    
    /**
     * 正解数を計算する関数
     * @returns {number} 正解の総数
     */
    function calculateTotalCorrect() {
        return results.filter(result => result.result === 'Correct').length;
    }
    
    // =============================
    // ユーザー応答イベントリスナーの追加
    // =============================
    
    // 左右ボタンのクリックイベント
    const leftButton = document.getElementById('leftButton');
    const rightButton = document.getElementById('rightButton');
    
    leftButton.addEventListener('click', () => checkResponse('left'));
    rightButton.addEventListener('click', () => checkResponse('right'));
    
    // タッチデバイス対応のため、タッチイベントを追加
    leftButton.addEventListener('touchstart', (e) => {
        e.preventDefault();
        checkResponse('left');
    });
    
    rightButton.addEventListener('touchstart', (e) => {
        e.preventDefault();
        checkResponse('right');
    });
    
    // キーボードの矢印キーによる応答をリスン
    document.addEventListener('keydown', function(event) {
        if (isExperimentEnded) return; // 実験終了後は無視
        
        if (isExperimentStarted && (event.key === 'ArrowLeft' || event.key === 'ArrowRight')) {
            const direction = event.key === 'ArrowLeft' ? 'left' : 'right';
            checkResponse(direction);
        }
    });
    
    // =============================
    // ユーザー名入力のリアルタイムバリデーション
    // =============================
    
    /**
     * ユーザー名入力時のリアルタイムバリデーション
     */
    usernameInput.addEventListener('input', () => {
        const isValid = /^[A-Za-z]*$/.test(usernameInput.value);
        if (!isValid) {
            usernameInput.setCustomValidity("ローマ字（英語のアルファベット）のみを使用してください。");
        } else {
            usernameInput.setCustomValidity("");
        }
    });
    
    // =============================
    // 結果送信ボタンのイベントリスナー
    // =============================
    
    submitButton.addEventListener('click', () => {
        username = usernameInput.value.trim();
        wakeStatus = [...wakeStatusInputs].find(input => input.checked)?.value;
        
        const isAlphabet = /^[A-Za-z]+$/.test(username);
        
        if (!username || !wakeStatus) {
            alert('名前と起床状況を選択してください。');
            return;
        }
        
        if (!isAlphabet) {
            alert("ローマ字（英語のアルファベット）のみを使用してください。");
            return;
        }
        
        sendResultsToServer(); // 結果をサーバーに送信
    });
    
    // =============================
    // 自動デバッグツールの実装
    // =============================
    
    /**
     * Predefined LayoutsとShuffled Layoutsをデバッグコンテナに表示する関数
     */
    function displayDebugInfo() {
        if (isDebugMode) {
            debugContainer.style.display = 'block';
            displayPredefinedLayouts();
            displayShuffledLayouts();
        }
    }
    
    /**
     * Predefined Layoutsを視覚的に表示する関数
     */
    function displayPredefinedLayouts() {
        // 反復配置のレイアウトを表示
        repeatedLayouts.forEach((layout, index) => {
            const layoutDiv = document.createElement('div');
            layoutDiv.classList.add('layout');
            
            const title = document.createElement('h4');
            title.textContent = `Repeated Layout ${layout.layoutId}`;
            layoutDiv.appendChild(title);
            
            // レイアウトを視覚的に表示
            renderLayoutVisual(layout, layoutDiv);
            
            layoutsList.appendChild(layoutDiv);
        });
        
        // ランダム配置のレイアウトを表示（Tの位置のみ表示、Lの位置はブロックごとに変わるため）
        randomLayouts.forEach((randomLayout, index) => {
            const layoutDiv = document.createElement('div');
            layoutDiv.classList.add('layout');
            
            const title = document.createElement('h4');
            title.textContent = `Random Layout ${randomLayout.layoutId} (T Position Fixed)`;
            layoutDiv.appendChild(title);
            
            // レイアウトを視覚的に表示（Lの位置は表示しない）
            const layoutContainer = document.createElement('div');
            layoutContainer.classList.add('visual-layout-container');
            layoutContainer.style.position = 'relative';
            layoutContainer.style.width = '200px';
            layoutContainer.style.height = '200px';
            layoutContainer.style.border = '1px solid #ccc';
            layoutContainer.style.marginBottom = '10px';
            layoutContainer.style.borderRadius = '5px';
            layoutContainer.style.backgroundColor = '#f9f9f9';
            
            // T字のみ表示
            const tItem = {
                rotation: randomLayout.tRotation,
                top: randomLayout.tPosition.top,
                left: randomLayout.tPosition.left
            };
            const tDiv = document.createElement('div');
            tDiv.textContent = 'T';
            tDiv.style.position = 'absolute';
            tDiv.style.width = '30px';
            tDiv.style.height = '30px';
            tDiv.style.display = 'flex';
            tDiv.style.justifyContent = 'center';
            tDiv.style.alignItems = 'center';
            tDiv.style.fontSize = '16px';
            tDiv.style.transform = `rotate(${tItem.rotation}deg)`;
            tDiv.style.backgroundColor = '#FFD700'; // 色分け
            tDiv.style.borderRadius = '3px';
            tDiv.style.border = '1px solid #000';
            tDiv.style.cursor = 'default';
            
            // パーセンテージをピクセルに変換（200px x 200pxのボックスを想定）
            const topPx = (tItem.top / 100) * 200 - 15; // 文字のサイズの半分を引く
            const leftPx = (tItem.left / 100) * 200 - 15;
            
            tDiv.style.top = `${topPx}px`;
            tDiv.style.left = `${leftPx}px`;
            
            layoutContainer.appendChild(tDiv);
            layoutDiv.appendChild(layoutContainer);
            
            layoutsList.appendChild(layoutDiv);
        });
    }
    
    /**
     * Shuffled Layoutsを視覚的に表示する関数
     */
    function displayShuffledLayouts() {
        const numberOfBlocks = 18;
        for (let block = 0; block < numberOfBlocks; block++) {
            const startIdx = block * 20;
            const endIdx = startIdx + 20;
            const blockLayouts = allLayouts.slice(startIdx, endIdx);
            displayBlockLayouts(block + 1, blockLayouts);
        }
    }
    
    /**
     * Shuffled Layoutsを視覚的に表示する関数
     * @param {number} blockNumber - ブロック番号
     * @param {Array} layouts - ブロック内のレイアウト配列
     */
    function displayBlockLayouts(blockNumber, layouts) {
        const blockDiv = document.createElement('div');
        blockDiv.classList.add('layout');
        
        const title = document.createElement('h4');
        title.textContent = `Block ${blockNumber} Layouts`;
        blockDiv.appendChild(title);
        
        // 各トライアルのレイアウトを視覚的に表示
        layouts.forEach((layout, trialIndex) => {
            const trialDiv = document.createElement('div');
            trialDiv.classList.add('trial-layout');
            
            const trialTitle = document.createElement('p');
            trialTitle.textContent = `Trial ${trialIndex + 1} (Layout ${layout.layoutId})`;
            trialDiv.appendChild(trialTitle);
            
            // レイアウトを視覚的に表示
            renderLayoutVisual(layout, trialDiv);
            
            blockDiv.appendChild(trialDiv);
        });
        
        blocksList.appendChild(blockDiv);
    }
    
    /**
     * レイアウトを視覚的に表示する関数
     * @param {Object} layout - レイアウトオブジェクト { layoutId: string, items: Array }
     * @param {HTMLElement} container - レイアウトを表示するコンテナ
     */
    function renderLayoutVisual(layout, container) {
        const layoutContainer = document.createElement('div');
        layoutContainer.classList.add('visual-layout-container');
        layoutContainer.style.position = 'relative';
        layoutContainer.style.width = '200px';
        layoutContainer.style.height = '200px';
        layoutContainer.style.border = '1px solid #ccc';
        layoutContainer.style.marginBottom = '10px';
        layoutContainer.style.borderRadius = '5px';
        layoutContainer.style.backgroundColor = '#f9f9f9';
        
        layout.items.forEach(item => {
            const letterDiv = document.createElement('div');
            letterDiv.textContent = item.letter;
            letterDiv.style.position = 'absolute';
            letterDiv.style.width = '30px';
            letterDiv.style.height = '30px';
            letterDiv.style.display = 'flex';
            letterDiv.style.justifyContent = 'center';
            letterDiv.style.alignItems = 'center';
            letterDiv.style.fontSize = '16px';
            letterDiv.style.transform = `rotate(${item.rotation}deg)`;
            letterDiv.style.backgroundColor = item.letter === 'T' ? '#FFD700' : '#87CEFA'; // 色分け
            letterDiv.style.borderRadius = '3px';
            letterDiv.style.border = '1px solid #000';
            letterDiv.style.cursor = 'default';
            
            // パーセンテージをピクセルに変換（200px x 200pxのボックスを想定）
            const topPx = (item.top / 100) * 200 - 15; // 文字のサイズの半分を引く
            const leftPx = (item.left / 100) * 200 - 15;
            
            letterDiv.style.top = `${topPx}px`;
            letterDiv.style.left = `${leftPx}px`;
            
            layoutContainer.appendChild(letterDiv);
        });
        
        container.appendChild(layoutContainer);
    }
    
    /**
     * レイアウトデータをCSVとしてエクスポートする関数
     */
    function exportLayoutsToCSV() {
        let csvContent = "data:text/csv;charset=utf-8,";
        csvContent += "Block,Trial,LayoutID,Letter,Rotation,Top,Left,LayoutType\n";
        
        allLayouts.forEach((layout, index) => {
            const block = Math.floor(index / 20) + 1;
            const trial = (index % 20) + 1;
            layout.items.forEach(item => {
                csvContent += `${block},${trial},${layout.layoutId},${item.letter},${item.rotation},${item.top},${item.left},${item.layoutType}\n`;
            });
        });
        
        const encodedUri = encodeURI(csvContent);
        const link = document.createElement("a");
        link.setAttribute("href", encodedUri);
        link.setAttribute("download", "layouts.csv");
        document.body.appendChild(link); // Firefoxでは必要
        link.click();
        document.body.removeChild(link);
    }
    
    // =============================
    // レイアウト初期化とデバッグ情報の表示
    // =============================
    
    /**
     * レイアウトを初期化し、デバッグ情報を表示する関数
     */
    function initializeLayouts() {
        initializeAllLayouts(); // 反復配置10種類とランダム配置10種類のレイアウトを生成し、18ブロックにシャッフルしてallLayoutsに格納
        if (isDebugMode) {
            displayDebugInfo(); // デバッグ情報を表示
        }
    }
    
    // =============================
    // 実験開始ボタンのクリックイベントリスナー
    // =============================
    
    // テスト開始ボタンのクリックイベント
    startTestButton.addEventListener('click', () => {
        instructionContainer.style.display = 'none'; // 説明文を非表示
        letterContainer.style.display = 'block'; // テストエリアを表示
        buttonsContainer.style.display = 'flex'; // ボタンエリアを表示
        trialCounter.style.display = 'block'; // テスト進行状況を表示
        
        initializeLayouts(); // レイアウトを生成
        startExperiment(); // 実験を開始
    });
    
    // =============================
    // 自動デバッグツールの実装
    // =============================
    
    // デバッグモード時にPredefined LayoutsとShuffled Layoutsを表示
    if (isDebugMode) {
        displayDebugInfo();
    }
    
    // デバッグモード時にCSVエクスポートボタンを有効化
    if (isDebugMode) {
        exportCSVButton.addEventListener('click', exportLayoutsToCSV);
    }
});
