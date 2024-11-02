import pandas as pd
import matplotlib.pyplot as plt
import seaborn as sns
from scipy.stats import ttest_ind
from statsmodels.formula.api import ols
from statsmodels.stats.anova import anova_lm
import numpy as np
import os

# CSVファイルのパスを指定
CSV_FILE = 'potential_test_results.csv'  # サーバー上のCSVファイルへのパスを指定

# CSVファイルの存在確認
if not os.path.exists(CSV_FILE):
    raise FileNotFoundError(f"指定されたCSVファイルが見つかりません: {CSV_FILE}")

# データの読み込み
data = pd.read_csv(CSV_FILE)

# データの確認
print("データの最初の5行:")
print(data.head())
print("\nLayoutTypeの種類:", data['LayoutType'].unique())

# データのクリーニング
data['ResponseTime(ms)'] = pd.to_numeric(data['ResponseTime(ms)'], errors='coerce')
data = data.dropna(subset=['ResponseTime(ms)'])
print(f"\nデータ数（不正解除外前）: {len(data)}")

# --- 1. 不正解の試行の除外 ---
data_correct = data[data['Result'] == 'Correct'].copy()
print(f"データ数（正解のみ）: {len(data_correct)}")

# --- 2. ブロックおよびテーブルの割り当て ---
# TrialNumberは整数型であるため、直接使用可能
# 20試行ごとにブロック（1-18）
data_correct['Block'] = ((data_correct['TrialNumber'] - 1) // 20) + 1  # 1から18

# 3ブロックごとにテーブル（1-6）
data_correct['Table'] = ((data_correct['Block'] - 1) // 3) + 1  # 1から6

print("\nブロックとテーブルの割り当て:")
print(data_correct[['TrialNumber', 'Block', 'Table']].head(25))

# --- 3. 外れ値の除外 ---
# テーブルごとに外れ値を除外
def remove_outliers(df, column):
    mean = df[column].mean()
    std = df[column].std()
    lower_bound = mean - 3 * std
    upper_bound = mean + 3 * std
    initial_count = len(df)
    df_filtered = df[(df[column] >= lower_bound) & (df[column] <= upper_bound)]
    removed = initial_count - len(df_filtered)
    print(f"テーブル {df.name} から外れ値を除外: {removed} 試行")
    return df_filtered

# 各テーブルごとにグループ化し外れ値を除外
data_no_outliers = data_correct.groupby('Table').apply(lambda x: remove_outliers(x, 'ResponseTime(ms)'))
data_no_outliers = data_no_outliers.reset_index(drop=True)
print(f"\nデータ数（外れ値除外後）: {len(data_no_outliers)}")

# --- 4. データの整形 ---
# ANOVAのために必要なカテゴリ型に変換
anova_data = data_no_outliers.copy()
anova_data['Table'] = anova_data['Table'].astype('category')
anova_data['LayoutType'] = anova_data['LayoutType'].astype('category')

# --- 5. カラム名の変更 ---
# ResponseTime(ms) の列名を ResponseTime_ms に変更
anova_data.rename(columns={'ResponseTime(ms)': 'ResponseTime_ms'}, inplace=True)

# --- 6. 2要因分散分析（ANOVA）の実施 ---
# ANOVAモデルの定義
model = ols('ResponseTime_ms ~ C(LayoutType) * C(Table)', data=anova_data).fit()
anova_table = anova_lm(model, typ=2)
print("\n2要因分散分析（ANOVA）の結果:")
print(anova_table)

# --- 7. 結果の可視化 ---
# グラフのスタイル設定
sns.set(style="whitegrid")

# a. 反応時間のボックスプロット（LayoutType別）
plt.figure(figsize=(10, 6))
sns.boxplot(x='LayoutType', y='ResponseTime_ms', data=anova_data, palette='Set2')
plt.title('Reaction Time Distribution by Layout Type')
plt.xlabel('Layout Type')
plt.ylabel('Reaction Time (ms)')
plt.savefig('reaction_time_boxplot_layout.png')
plt.show()

# b. 反応時間の平均と標準誤差のバーグラフ
plt.figure(figsize=(10, 6))
# Seabornの最新バージョンでは、ciパラメータは非推奨であり、errorbarを使用します。
# ただし、'se'の指定は適切ではないため、代わりに 'ci=95' を使用します。
# エラーバーとして標準誤差を表示したい場合は、以下のようにカスタムエラーバーを計算します。
mean_rt = anova_data.groupby('LayoutType')['ResponseTime_ms'].mean().reset_index()
se_rt = anova_data.groupby('LayoutType')['ResponseTime_ms'].sem().reset_index()

# バーグラフの作成
sns.barplot(x='LayoutType', y='ResponseTime_ms', data=anova_data, palette='Set2', ci=None)
# エラーバーの追加
plt.errorbar(x=range(len(mean_rt)), y=mean_rt['ResponseTime_ms'], yerr=se_rt['ResponseTime_ms'],
             fmt='none', c='black', capsize=5)

plt.title('Mean Reaction Time by Layout Type')
plt.xlabel('Layout Type')
plt.ylabel('Mean Reaction Time (ms)')
plt.savefig('reaction_time_mean_se.png')
plt.show()

# c. 反応時間の2要因分散分析の結果を示すグラフ
# LayoutTypeごとのTableごとの平均反応時間をプロット
mean_rt_table = anova_data.groupby(['LayoutType', 'Table'])['ResponseTime_ms'].mean().reset_index()

plt.figure(figsize=(12, 8))
sns.pointplot(x='Table', y='ResponseTime_ms', hue='LayoutType', data=mean_rt_table, dodge=True, markers=['o', 's'], capsize=.1, errwidth=1, palette='Set2')
plt.title('Mean Reaction Time by Layout Type and Table')
plt.xlabel('Table')
plt.ylabel('Mean Reaction Time (ms)')
plt.legend(title='Layout Type')
plt.savefig('reaction_time_pointplot.png')
plt.show()

# --- 8. 追加: データの保存 ---
# ANOVA統計量をCSVに保存
anova_table.to_csv('experiment_anova_statistics.csv')
print("\nANOVA統計量が 'experiment_anova_statistics.csv' に保存されました。")

# グラフの保存も既に行われています。
