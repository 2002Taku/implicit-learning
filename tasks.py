# tasks.py

import os
import logging
from analysis import (
    load_and_clean_data,
    compute_mean_response_time,
    perform_anova,
    visualize_data,
    save_anova_results,
    save_mean_data
)

# ログの設定
logging.basicConfig(level=logging.INFO, format='%(asctime)s - %(levelname)s - %(message)s')
logger = logging.getLogger(__name__)

def analyze_data(filename):
    """
    指定されたCSVファイルを分析します。
    
    Parameters:
    - filename (str): 分析対象のCSVファイル名（例: 'Implic_Learning_results.csv' または '{participant}_results.csv'）
    """
    logger.info(f"Starting analysis for file: {filename}")
    CSV_FILE = os.path.join('data', filename)  # ファイルパスを 'data/' ディレクトリに設定

    if not os.path.exists(CSV_FILE):
        logger.error(f"CSV file does not exist: {CSV_FILE}")
        return

    try:
        # データの読み込みとクレンジング
        data_no_outliers = load_and_clean_data(CSV_FILE)
        logger.info("Data loaded and cleaned successfully.")

        # 平均応答時間の計算
        mean_data = compute_mean_response_time(data_no_outliers)
        participant = os.path.splitext(filename)[0].replace('_results', '')
        save_mean_data(mean_data, participant=participant, sorted_by_participant=False)
        logger.info("Mean response time computed and saved.")

        # ANOVAの実行
        anova_table = perform_anova(mean_data, participant=participant)
        if anova_table is not None:
            save_anova_results(anova_table, participant=participant)
            logger.info(f"ANOVA results saved for participant: {participant}")
            visualize_data(mean_data, participant=participant)
            logger.info(f"Data visualization completed for participant: {participant}")
        else:
            logger.warning("ANOVA table is None. Skipping save and visualize steps.")

        logger.info("Analysis completed successfully.")
    except Exception as e:
        logger.error(f"Error during analysis: {e}")
        import traceback
        traceback.print_exc()
        raise e

    return "分析完了"

if __name__ == '__main__':
    # テスト実行用
    analyze_data('Implic_Learning_results.csv')
