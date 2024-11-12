# analysis.py

import pandas as pd
import matplotlib.pyplot as plt
import seaborn as sns
from statsmodels.formula.api import ols
from statsmodels.stats.anova import anova_lm
import os
import logging

# ログの設定
logging.basicConfig(level=logging.INFO, format='%(asctime)s - %(levelname)s - %(message)s')
logger = logging.getLogger(__name__)

def remove_outliers(df, column):
    """指定された列の外れ値を除外する関数"""
    mean = df[column].mean()
    std = df[column].std()
    lower_bound = mean - 3 * std
    upper_bound = mean + 3 * std
    initial_count = len(df)
    df_filtered = df[(df[column] >= lower_bound) & (df[column] <= upper_bound)]
    removed = initial_count - len(df_filtered)
    
    # テーブル名を取得（データフレームに 'Table' 列が存在する前提）
    table_name = df['Table'].iloc[0] if not df.empty and 'Table' in df.columns else 'Unknown Table'
    logger.info(f"テーブル {table_name} から外れ値を除外: {removed} 試行")
    return df_filtered

def load_and_clean_data(csv_file):
    """CSVファイルを読み込み、データをクリーニングする関数"""
    try:
        # データの読み込み
        data = pd.read_csv(csv_file)
        logger.info("データの最初の5行:")
        logger.info(data.head())
        
        # 列名をリストでログに出力
        logger.info(f"データの列名: {data.columns.tolist()}")
        
        # 正しい列名を使用する
        if 'layoutType' in data.columns:
            layout_types = data['layoutType'].unique()
            logger.info(f"layoutTypeの種類: {layout_types}")
        else:
            logger.error("CSVファイルに 'layoutType' 列が存在しません。")
            raise KeyError("layoutType")
        
        # データのクリーニング
        if 'responseTime' in data.columns:
            data['responseTime'] = pd.to_numeric(data['responseTime'], errors='coerce')
            data = data.dropna(subset=['responseTime'])
            logger.info(f"データ数（不正解除外前）: {len(data)}")
        else:
            logger.error("CSVファイルに 'responseTime' 列が存在しません。")
            raise KeyError("responseTime")
        
        # 正解の試行のみを抽出
        if 'result' in data.columns:
            data_correct = data[data['result'] == 'Correct'].copy()
            logger.info(f"データ数（正解のみ）: {len(data_correct)}")
        else:
            logger.error("CSVファイルに 'result' 列が存在しません。")
            raise KeyError("result")
        
        # ブロックおよびテーブルの割り当て
        if 'trialNumber' in data_correct.columns:
            data_correct['Block'] = ((data_correct['trialNumber'] - 1) // 20) + 1  # 1から18
        else:
            logger.error("CSVファイルに 'trialNumber' 列が存在しません。")
            raise KeyError("trialNumber")
        
        if 'Block' in data_correct.columns:
            data_correct['Table'] = ((data_correct['Block'] - 1) // 3) + 1  # 1から6
            logger.info("ブロックとテーブルの割り当て:")
            logger.info(data_correct[['trialNumber', 'Block', 'Table']].head(25))
        else:
            logger.error("ブロックの割り当てに失敗しました。")
            raise KeyError("Block")
        
        # 外れ値の除外
        if 'Table' in data_correct.columns:
            data_correct['Table'] = data_correct['Table'].astype('category')  # グループ化のためにカテゴリ型に変換
            data_no_outliers = data_correct.groupby('Table').apply(lambda x: remove_outliers(x, 'responseTime'))
            data_no_outliers = data_no_outliers.reset_index(drop=True)
            logger.info(f"データ数（外れ値除外後）: {len(data_no_outliers)}")
        else:
            logger.error("CSVファイルに 'Table' 列が存在しません。")
            raise KeyError("Table")
        
        return data_no_outliers
    except KeyError as e:
        logger.error(f"KeyError: {e}")
        raise
    except Exception as e:
        logger.error(f"Error in load_and_clean_data: {e}")
        raise

def compute_mean_response_time(data):
    """回答者ごと、layoutTypeごと、Tableごとに反応時間の平均を計算する関数"""
    try:
        required_columns = ['participant', 'layoutType', 'Table', 'responseTime']
        for col in required_columns:
            if col not in data.columns:
                logger.error(f"DataFrameに '{col}' 列が存在しません。")
                raise KeyError(col)
        
        mean_data = data.groupby(['participant', 'layoutType', 'Table']).agg({'responseTime': 'mean'}).reset_index()
        mean_data.rename(columns={'responseTime': 'MeanResponseTime_ms'}, inplace=True)
        logger.info("Mean response time calculated successfully.")
        return mean_data
    except KeyError as e:
        logger.error(f"KeyError: {e}")
        raise
    except Exception as e:
        logger.error(f"Error in compute_mean_response_time: {e}")
        raise

def perform_anova(data, participant=None):
    """2要因分散分析（ANOVA）を実施する関数。participantが指定されている場合はその回答者のみを分析"""
    try:
        if participant:
            logger.info(f"指定された参加者 '{participant}' のデータを抽出します。")
            data = data[data['participant'] == participant]
            if data.empty:
                logger.warning(f"指定された参加者 '{participant}' のデータが見つかりません。")
                return None
            logger.info(f"{participant} のデータ数: {len(data)}")
        else:
            logger.info("全体のデータを分析します。")
        
        # layoutTypeとTableをカテゴリ型に変換
        data['layoutType'] = data['layoutType'].astype('category')
        data['Table'] = data['Table'].astype('category')
        
        # ANOVAモデルの定義
        model = ols('MeanResponseTime_ms ~ C(layoutType) * C(Table)', data=data).fit()
        anova_table = anova_lm(model, typ=2)
        
        if participant:
            logger.info(f"{participant} の2要因分散分析（ANOVA）の結果:")
        else:
            logger.info("全体の2要因分散分析（ANOVA）の結果:")
        logger.info(anova_table)
        
        return anova_table
    except Exception as e:
        logger.error(f"Error in perform_anova: {e}")
        raise

def visualize_data(data, participant=None):
    """データを可視化する関数。participantが指定されている場合はその回答者のみを可視化"""
    try:
        if participant:
            logger.info(f"{participant} のデータを可視化します。")
            data = data[data['participant'] == participant]
            if data.empty:
                logger.warning(f"指定された参加者 '{participant}' のデータが見つかりません。")
                return
        else:
            logger.info("全体のデータを可視化します。")
        
        sns.set(style="whitegrid")
        
        # a. 反応時間のボックスプロット（layoutType別）
        plt.figure(figsize=(10, 6))
        sns.boxplot(x='layoutType', y='MeanResponseTime_ms', data=data, palette='Set2')
        title = 'Average Reaction Time by Layout Type'
        if participant:
            title += f' for {participant}'
        plt.title(title)
        plt.xlabel('Layout Type')
        plt.ylabel('Average Reaction Time (ms)')
        filename = 'average_reaction_time_boxplot_layout'
        if participant:
            filename += f'_{participant}'
        filename += '.png'
        plt.savefig(os.path.join('data', filename))
        plt.close()
        logger.info(f"ボックスプロットを '{filename}' として保存しました。")
        
        # b. 反応時間の平均と標準誤差のバーグラフ
        plt.figure(figsize=(10, 6))
        mean_rt = data.groupby('layoutType')['MeanResponseTime_ms'].mean().reset_index()
        se_rt = data.groupby('layoutType')['MeanResponseTime_ms'].sem().reset_index()
        
        sns.barplot(x='layoutType', y='MeanResponseTime_ms', data=data, palette='Set2', ci=None)
        plt.errorbar(x=range(len(mean_rt)), y=mean_rt['MeanResponseTime_ms'], yerr=se_rt['MeanResponseTime_ms'],
                     fmt='none', c='black', capsize=5)
        
        plt.title('Mean Reaction Time by Layout Type')
        if participant:
            plt.title(f'Mean Reaction Time by Layout Type for {participant}')
        plt.xlabel('Layout Type')
        plt.ylabel('Mean Reaction Time (ms)')
        filename = 'average_reaction_time_mean_se'
        if participant:
            filename += f'_{participant}'
        filename += '.png'
        plt.savefig(os.path.join('data', filename))
        plt.close()
        logger.info(f"平均と標準誤差のバーグラフを '{filename}' として保存しました。")
        
        # c. layoutTypeごとのTableごとの平均反応時間をプロット
        plt.figure(figsize=(12, 8))
        sns.pointplot(x='Table', y='MeanResponseTime_ms', hue='layoutType', data=data, dodge=True, markers=['o', 's'], capsize=.1, errwidth=1, palette='Set2')
        plt.title('Mean Reaction Time by Layout Type and Table')
        if participant:
            plt.title(f'Mean Reaction Time by Layout Type and Table for {participant}')
        plt.xlabel('Table')
        plt.ylabel('Mean Reaction Time (ms)')
        plt.legend(title='Layout Type')
        filename = 'average_reaction_time_pointplot'
        if participant:
            filename += f'_{participant}'
        filename += '.png'
        plt.savefig(os.path.join('data', filename))
        plt.close()
        logger.info(f"ポイントプロットを '{filename}' として保存しました。")
    except Exception as e:
        logger.error(f"Error in visualize_data: {e}")
        raise

def save_anova_results(anova_table, participant=None):
    """ANOVAの結果をCSVに保存する関数"""
    try:
        if participant:
            filename = f'experiment_anova_statistics_{participant}.csv'
        else:
            filename = 'experiment_anova_statistics_all_participants.csv'
        filepath = os.path.join('data', filename)  # 'data' ディレクトリ内に保存
        anova_table.to_csv(filepath)
        if participant:
            logger.info(f"{participant} のANOVA統計量が '{filepath}' に保存されました。")
        else:
            logger.info(f"全体のANOVA統計量が '{filepath}' に保存されました。")
    except Exception as e:
        logger.error(f"Error in save_anova_results: {e}")
        raise

def save_mean_data(mean_data, participant=None, sorted_by_participant=True):
    """平均化されたデータをCSVに保存する関数"""
    try:
        if sorted_by_participant:
            mean_data_sorted = mean_data.sort_values(by='participant')
            filename = 'mean_response_time_sorted_by_participant.csv'
            filepath = os.path.join('data', filename)
            mean_data_sorted.to_csv(filepath, index=False)
            logger.info(f"ソートされた平均化データが '{filepath}' に保存されました。")
        else:
            filename = f'mean_response_time_sorted_by_participant_{participant}.csv' if participant else 'mean_response_time_sorted_by_participant.csv'
            filepath = os.path.join('data', filename)
            mean_data.to_csv(filepath, index=False)
            logger.info(f"平均化データが '{filepath}' に保存されました。")
    except Exception as e:
        logger.error(f"Error in save_mean_data: {e}")
        raise
