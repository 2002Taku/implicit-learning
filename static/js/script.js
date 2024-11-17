document.addEventListener("DOMContentLoaded", function() {
    // =============================
    // DOM要素の取得
    // =============================
    const practiceContainer = document.getElementById('practiceContainer');
    const mainExperimentContainer = document.getElementById('mainExperimentContainer');

    const userForm = document.getElementById('userForm');
    const submitButton = document.getElementById('submitButton');
    const usernameInput = document.getElementById('username');
    const wakeStatusInputs = document.getElementsByName('wakeStatus');
    const letterContainer = document.getElementById('letterContainer');
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
    let mainLayouts = [];     // 本番トライアル用のシャッフルされたレイアウト（18ブロック × 20レイアウト = 360トライアル）
    let practiceLayouts = []; // 練習トライアルのレイアウト

    let trialCount = 0;       // 本番セクションの現在のトライアル番号（0〜359）
    let results = [];         // ユーザーの応答結果を格納

    let isExperimentStarted = false; // 実験が開始されたかどうかのフラグ
    let isExperimentEnded = false;   // 実験が終了したかどうかのフラグ

    let isPractice = false;          // 練習中かどうかのフラグ
    let practiceTrials = 10;         // 練習問題の数
    let practiceTrialCount = 0;      // 現在の練習トライアル番号

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
            const layoutItems = generateFixedLayout(containerSize, 'repeated', layoutId);

            repeatedLayouts.push({
                layoutId: layoutId,
                items: layoutItems
            });
        }

        // ランダム配置のレイアウト生成
        for (let i = 0; i < 10; i++) {
            const layoutId = String.fromCharCode(65 + i); // A〜J
            const layoutItems = generateFixedLayout(containerSize, 'random', layoutId);

            randomLayouts.push({
                layoutId: layoutId,
                items: layoutItems
            });
        }
    }

    /**
     * 固定レイアウトのT字とL字を生成する関数
     * @param {number} containerSize - コンテナのサイズ
     * @param {string} layoutType - 'repeated' または 'random' または 'practice'
     * @param {string} layoutId - レイアウトの識別子
     * @returns {Array} レイアウト内の文字情報の配列
     */
    function generateFixedLayout(containerSize, layoutType, layoutId) {
        let layout = [];

        // クアドラントをランダムに選択
        const tQuadrant = getRandomQuadrant();
        const tPosition = getRandomPositionWithinQuadrant(tQuadrant);
        const tRotation = getRandomRotation(true);

        // T字を配置（回転角度は90度または270度のみ）
        layout.push({
            letter: 'T',
            rotation: tRotation, // 90度または270度
            top: tPosition.top, // パーセンテージ
            left: tPosition.left, // パーセンテージ
            layoutType: layoutType, // レイアウトタイプ
            layoutId: layoutId // レイアウトID
        });

        // L字を配置
        const numLLetters = 11; // 練習でも本番と同じ数を生成
        for (let i = 0; i < numLLetters; i++) {
            let lQuadrant = getRandomQuadrant();
            let lPosition = getRandomPositionWithinQuadrant(lQuadrant, layout);
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
     * ランダムにクアドラントを選択する関数
     * @returns {Object} 選択されたクアドラントのオブジェクト
     */
    function getRandomQuadrant() {
        const quadrants = [
            { name: 'Top-Left', topMin: 0, topMax: 50, leftMin: 0, leftMax: 50 },
            { name: 'Top-Right', topMin: 0, topMax: 50, leftMin: 50, leftMax: 100 },
            { name: 'Bottom-Left', topMin: 50, topMax: 100, leftMin: 0, leftMax: 50 },
            { name: 'Bottom-Right', topMin: 50, topMax: 100, leftMin: 50, leftMax: 100 }
        ];
        const index = Math.floor(Math.random() * quadrants.length);
        return quadrants[index];
    }

    /**
     * 指定されたクアドラント内でランダムな位置を取得する関数
     * @param {Object} quadrant - クアドラントのオブジェクト
     * @param {Array} currentLayout - 現在のレイアウト配列（重複回避用）
     * @returns {Object} 位置 { top: number, left: number }
     */
    function getRandomPositionWithinQuadrant(quadrant, currentLayout = []) {
        let position;
        let attempts = 0;
        let isValid = false;

        // バッファを設定（文字のサイズと回転を考慮）
        const buffer = 6.25; // 12.5%（文字サイズ）の半分

        // クアドラント内の有効範囲を計算
        const effectiveTopMin = quadrant.topMin + buffer;
        const effectiveTopMax = quadrant.topMax - buffer;
        const effectiveLeftMin = quadrant.leftMin + buffer;
        const effectiveLeftMax = quadrant.leftMax - buffer;

        while (!isValid && attempts < 100) {
            position = {
                top: getRandomPosition(effectiveTopMin, effectiveTopMax),
                left: getRandomPosition(effectiveLeftMin, effectiveLeftMax)
            };

            // 既存の文字との重複を避ける
            const overlapping = currentLayout.some(item => {
                const distanceTop = Math.abs(item.top - position.top);
                const distanceLeft = Math.abs(item.left - position.left);
                return (distanceTop < buffer) && (distanceLeft < buffer); // バッファ以内の距離であれば重複とみなす
            });

            if (!overlapping) {
                isValid = true;
            }

            attempts++;
        }

        if (isValid) {
            return position;
        } else {
            // デフォルト位置（クアドラントの中央）
            return {
                top: (quadrant.topMin + quadrant.topMax) / 2,
                left: (quadrant.leftMin + quadrant.leftMax) / 2
            };
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
    function initializeMainLayouts() {
        const containerSize = Math.min(letterContainer.clientWidth, letterContainer.clientHeight);
        generateLayouts(containerSize); // 反復配置10種類とランダム配置10種類のレイアウトを生成

        const numberOfBlocks = 18;
        const layoutsPerBlock = 20;

        for (let block = 0; block < numberOfBlocks; block++) {
            let blockLayouts = [];

            // ランダム配置のレイアウトを追加
            randomLayouts.forEach(randomLayout => {
                blockLayouts.push(randomLayout);
            });

            // 反復配置のレイアウトを追加（固定）
            repeatedLayouts.forEach(repeatedLayout => {
                blockLayouts.push(repeatedLayout);
            });

            // レイアウトをシャッフル
            let shuffledBlockLayouts = shuffleArray([...blockLayouts]);
            mainLayouts.push(...shuffledBlockLayouts); // mainLayoutsに追加

            // デバッグモード時に各ブロックのシャッフル結果を表示
            if (isDebugMode) {
                console.log(`Block ${block + 1} Layouts:`, shuffledBlockLayouts);
                displayBlockLayouts(block + 1, shuffledBlockLayouts);
            }
        }

        // デバッグモード時にPredefined Layoutsを表示
        if (isDebugMode) {
            displayPredefinedLayouts();
            console.log('Main Layouts:', mainLayouts);
        }
    }

    // =============================
    // 練習レイアウト初期化関数
    // =============================

    /**
     * 練習用レイアウトを生成する関数
     */
    function generatePracticeLayouts() {
        for (let i = 0; i < practiceTrials; i++) {
            const layoutType = 'practice';
            const layoutId = `Practice-${i + 1}`;
            const layoutItems = generateFixedLayout(Math.min(letterContainer.clientWidth, letterContainer.clientHeight), layoutType, layoutId);

            practiceLayouts.push({
                layoutId: layoutId,
                items: layoutItems
            });
        }

        // デバッグモード時にPredefined Layoutsを表示
        if (isDebugMode) {
            displayPredefinedLayouts();
            console.log('Practice Layouts:', practiceLayouts);
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
            letterDiv.style.transform = `translate(-50%, -50%) rotate(${item.rotation}deg)`;
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
        results = [];
        startTime = Date.now(); // 実験開始時刻を記録

        // カーソルを非表示にするクラスを追加
        document.body.classList.add('hide-cursor');

        if (isPractice) {
            displayPracticeTrial(); // 練習トライアルを開始
        } else {
            trialCount = 0;
            nextTrial(); // 本番トライアルを開始
        }
    }

    /**
     * 次のトライアルを実行する関数
     */
    function nextTrial() {
        if (trialCount < mainLayouts.length) { // 本番セクションのトライアル数を確認
            const currentBlock = Math.floor(trialCount / 20) + 1;
            trialCounter.textContent = `ブロック: ${currentBlock} / 18`;

            const currentLayout = mainLayouts[trialCount];
            displayLetters(currentLayout);
            letterContainer.style.visibility = 'visible';

            trialStartTime = Date.now(); // トライアル開始時刻を記録
            trialCount++;
        } else {
            endExperiment(); // 実験終了
        }
    }

    // =============================
    // 練習トライアル管理
    // =============================

    /**
     * 練習トライアルを表示する関数
     */
    function displayPracticeTrial() {
        if (practiceTrialCount < practiceTrials) {
            const currentLayout = practiceLayouts[practiceTrialCount];
            displayLetters(currentLayout);
            letterContainer.style.visibility = 'visible';
            trialCounter.style.display = 'block';
            trialCounter.textContent = `練習: ${practiceTrialCount + 1} / ${practiceTrials}`;

            trialStartTime = Date.now(); // トライアル開始時刻を記録
            practiceTrialCount++;
        } else {
            // 練習終了後、本番セクションを表示
            letterContainer.style.display = 'none';
            trialCounter.style.display = 'none';
            practiceContainer.style.display = 'none';
            mainExperimentContainer.style.display = 'flex'; // 本番セクションを表示（'flex'に変更）
            isPractice = false; // 練習終了時にフラグをリセット
            isExperimentStarted = false; // 実験開始フラグをリセット（修正点）
            console.log('Practice trials ended. Ready to start main experiment.');
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

        let currentLayout;
        if (isPractice) {
            currentLayout = practiceLayouts[practiceTrialCount - 1]; // 練習セクションのレイアウトを取得
        } else {
            currentLayout = mainLayouts[trialCount - 1]; // 本番セクションのレイアウトを取得
        }

        const targetItem = currentLayout.items.find(item => item.letter === 'T');
        const targetRotation = targetItem ? targetItem.rotation : 0;
        const layoutType = targetItem ? targetItem.layoutType : 'unknown';
        const layoutId = targetItem ? targetItem.layoutId : 'unknown';

        // 正誤判定
        const isCorrect = (response === 'left' && targetRotation === 270) || (response === 'right' && targetRotation === 90);

        if (!isCorrect) {
            triggerIncorrectFeedback();
        }

        // 結果を記録
        if (!isPractice) { // 本番実験のみデータを保存
            results.push({
                participant: username,
                condition: wakeStatus,
                testType: 'Implicit Learning',
                trialNumber: `${trialCount}`, // trialNumberを1〜360に設定
                layoutId: layoutId, // layoutIdを記録
                layoutType: layoutType,
                result: isCorrect ? 'Correct' : 'Incorrect',
                responseTime: `${reactionTime}`
            });
        }

        // デバッグモード時に結果をコンソールに表示
        if (isDebugMode) {
            console.log(`Trial ${isPractice ? 'Practice-' + practiceTrialCount : trialCount}: Response=${response}, Rotation=${targetRotation}, Correct=${isCorrect}`);
        }

        // 次のトライアルへ進む準備
        letterContainer.style.visibility = 'hidden';

        if (isPractice) {
            setTimeout(displayPracticeTrial, 300); // 練習トライアルに進む前に300msの遅延
        } else {
            setTimeout(nextTrial, 300); // 本番トライアルに進む前に300msの遅延
        }
    }

    /**
     * 不正解時のフィードバックをトリガーする関数
     * 画面を赤く点滅させ、音声を再生します
     */
    function triggerIncorrectFeedback() {
        // 赤色のクラスを一時的に追加
        document.body.classList.add('incorrect-feedback');

        // 音声を再生
        const audio = new Audio('/static/incorrect.mp3'); // 音声ファイルのパスを確認してください
        audio.play();

        // クラスを元に戻す
        setTimeout(() => {
            document.body.classList.remove('incorrect-feedback');
        }, 500); // 0.5秒後にクラスを削除
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

        // カーソルを再表示するクラスを削除
        document.body.classList.remove('hide-cursor');

        // テストエリアを非表示
        letterContainer.style.display = 'none';
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

        fetch('/proxy', { // Flaskのルートに合わせてURLを変更
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
        const totalCorrect = calculateTotalCorrect();
        userForm.style.display = 'none'; // フォームを非表示

        const resultContainer = document.createElement('div');
        resultContainer.classList.add('result-container');
        resultContainer.innerHTML = `
            <p>結果は送信されました。回答ありがとうございます。</p>
            <p>総正解数: ${totalCorrect} / ${mainLayouts.length}</p>
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

    /**
     * 矢印キー（←、→）およびスペースキーによる応答を処理するイベントリスナー
     */
    document.addEventListener('keydown', function(event) {
        console.log(`Key pressed: ${event.key} (${event.code})`); // デバッグ用ログ

        if (isExperimentEnded) return; // 実験終了後は無視

        // 練習セクション開始のスペースキー検出
        if (window.getComputedStyle(practiceContainer).display !== 'none' && !isExperimentStarted && !isPractice) {
            if (event.code === 'Space') {
                event.preventDefault(); // スペースキーのデフォルト動作を防止
                console.log('Space key pressed to start practice'); // デバッグ用ログ
                practiceContainer.style.display = 'none'; // 練習セクションを非表示
                letterContainer.style.display = 'block';  // テストエリアを表示
                trialCounter.style.display = 'block';     // カウンターを表示
                isPractice = true;
                startExperiment();                        // 練習実験を開始
                return; // 練習開始後は他の条件を評価しない
            }
        }

        if (isPractice) {
            // 練習中の応答処理
            if (event.key === 'ArrowLeft' || event.key === 'ArrowRight') {
                const direction = event.key === 'ArrowLeft' ? 'left' : 'right';
                checkResponse(direction);
            }
        } else if (window.getComputedStyle(mainExperimentContainer).display !== 'none' && !isExperimentStarted) {
            // 本番セクション開始前のスペースキー検出
            console.log('Checking main experiment conditions...');
            console.log(`mainExperimentContainer display: ${window.getComputedStyle(mainExperimentContainer).display}`);
            console.log(`isExperimentStarted: ${isExperimentStarted}`);

            if (event.code === 'Space') {
                event.preventDefault(); // スペースキーのデフォルト動作（ページ下部へのスクロールなど）を防止
                console.log('Space key pressed to start main experiment'); // デバッグ用ログ
                mainExperimentContainer.style.display = 'none'; // 本番セクションを非表示
                letterContainer.style.display = 'block';        // テストエリアを表示
                trialCounter.style.display = 'block';           // カウンターを表示
                isPractice = false;                             // 本番開始時にフラグをリセット
                isExperimentStarted = true;                     // 本番実験を開始
                startExperiment();                              // 本番実験を開始
                return; // 本番開始後は他の条件を評価しない
            }
        } else {
            // 本番実験中の応答処理
            if (isExperimentStarted && (event.key === 'ArrowLeft' || event.key === 'ArrowRight')) {
                const direction = event.key === 'ArrowLeft' ? 'left' : 'right';
                checkResponse(direction);
            }
        }
    });

    // =============================
    // フォーム送信イベントリスナーの追加
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
    // デバッグモード関連関数
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
            const tItem = randomLayout.items.find(item => item.letter === 'T');
            if (tItem) {
                const tDiv = document.createElement('div');
                tDiv.textContent = 'T';
                tDiv.style.position = 'absolute';
                tDiv.style.width = '30px';
                tDiv.style.height = '30px';
                tDiv.style.display = 'flex';
                tDiv.style.justifyContent = 'center';
                tDiv.style.alignItems = 'center';
                tDiv.style.fontSize = '16px';
                tDiv.style.transform = `translate(-50%, -50%) rotate(${tItem.rotation}deg)`;
                tDiv.style.backgroundColor = '#FFD700'; // 色分け
                tDiv.style.borderRadius = '3px';
                tDiv.style.border = '1px solid #000';
                tDiv.style.cursor = 'default';

                // パーセンテージをピクセルに変換（200px x 200pxのボックスを想定）
                const topPx = (tItem.top / 100) * 200;
                const leftPx = (tItem.left / 100) * 200;

                tDiv.style.top = `${topPx}px`;
                tDiv.style.left = `${leftPx}px`;

                layoutContainer.appendChild(tDiv);
            }

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
            const blockLayouts = mainLayouts.slice(startIdx, endIdx);
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
            letterDiv.style.transform = `translate(-50%, -50%) rotate(${item.rotation}deg)`;
            letterDiv.style.backgroundColor = item.letter === 'T' ? '#FFD700' : '#87CEFA'; // 色分け
            letterDiv.style.borderRadius = '3px';
            letterDiv.style.border = '1px solid #000';
            letterDiv.style.cursor = 'default';

            // パーセンテージをピクセルに変換（200px x 200pxのボックスを想定）
            const topPx = (item.top / 100) * 200;
            const leftPx = (item.left / 100) * 200;

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

        mainLayouts.forEach((layout, index) => {
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
    // 実験初期化関数
    // =============================

    /**
     * レイアウトを初期化し、デバッグ情報を表示する関数
     */
    function initializeExperiment() {
        initializeMainLayouts();    // 本番トライアルを初期化
        generatePracticeLayouts();  // 練習トライアルを初期化
        if (isDebugMode) {
            displayDebugInfo();     // デバッグ情報を表示
        }
        // 練習セクションはすでに表示されているため、開始はスペースキーで行う
    }

    // =============================
    // 初期化の呼び出し
    // =============================

    initializeExperiment();

    // =============================
    // デバッグモード時にCSVエクスポートボタンを有効化
    // =============================

    if (isDebugMode) {
        exportCSVButton.addEventListener('click', exportLayoutsToCSV);
    }
});
