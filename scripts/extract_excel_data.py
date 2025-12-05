import openpyxl
import sys

def extract_data(file_path):
    try:
        wb = openpyxl.load_workbook(file_path, data_only=True) # data_only=True to get values, not formulas
    except Exception as e:
        print(f"Error loading workbook: {e}")
        return

    ws = wb.active
    print(f"Sheet: {ws.title}")

    # 1. Look for Entities and Balances (RECAP STE)
    # Based on previous analysis, it seemed to be around row 67, but let's scan.
    print("\n--- Scanning for Data ---")
    
    # We'll print a grid of the first 100 rows to manually identify the tables again with values
    for i, row in enumerate(ws.iter_rows(values_only=True)):
        if i > 100: break
        # Filter None
        row_data = [str(c) if c is not None else "" for c in row]
        # Only print if row has some content
        if any(row_data):
            print(f"Row {i+1}: {row_data}")

if __name__ == "__main__":
    if len(sys.argv) > 1:
        extract_data(sys.argv[1])
    else:
        print("Please provide file path")
