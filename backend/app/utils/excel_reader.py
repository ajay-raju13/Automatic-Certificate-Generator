import pandas as pd

def read_excel_rows(path):
    df = pd.read_excel(path)
    df = df.fillna("")
    return df.to_dict(orient="records")
