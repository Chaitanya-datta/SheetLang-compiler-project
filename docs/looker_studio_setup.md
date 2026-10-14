# Google Looker Studio Integration Guide (Linux Alternative to Power BI)

This guide adapts the original Power BI instructions to **Google Looker Studio**, which is 100% web-based, free, and works perfectly on Linux.

## PART 1 — Getting Started

1. Go to **[lookerstudio.google.com](https://lookerstudio.google.com)**.
2. Sign in with any Google account.
3. Click the big **Blank Report** button (the `+` icon) in the top left.

## PART 2 — Load the CSV Data

1. When the "Add data to report" menu pops up, scroll down and click **File Upload**.
2. You will need to authorize Looker Studio to use Google Cloud Storage (just click Authorize).
3. Click to upload files and browse to wherever you saved `sheetlang_compilations.csv` (exported from your backend API).
4. Wait for the status to say "Uploaded" and click the **Add** button in the bottom right, then **Add to Report**.

## PART 3 — Data Cleaning (Timestamps & Success Column)

Unlike Power BI's Power Query Editor, Looker Studio uses calculated fields to clean data. 

1. On the far right side, look at the **Data** pane where your CSV fields are listed. 
2. Click **Add a field** at the very bottom of the Data pane.
3. **Clean the Success Column**:
   - Field Name: Type `Success Status`
   - Formula: Type the following exactly:
     ```sql
     CASE WHEN success = 1 THEN "Success" ELSE "Failed" END
     ```
   - Click **Save**, then click **Done**.
4. **Fix Timestamp Type**:
   - In the Data pane, hover over `timestamp` and click the `ABC` or date icon next to it.
   - Change the type to **Date & Time** → **Date Hour Minute** (or just Date & Time).

## PART 4 — Set the Visual Theme

1. On the top toolbar, click **Theme and Layout**.
2. A panel opens on the right. Pick a clean, dark theme like **Constellation**, **Edge**, or **Midnight** to get that professional executive look.
3. Click the **Layout** tab at the top of that right panel, scroll down to **Canvas Size**, and set it to **16:9** (e.g., 1280 x 720).

---

## PART 5 — Build Page 1: Executive Overview

### Header
1. Rename the page: On the top left it says "Page 1". Click it and rename it to `Executive Overview`.
2. Click the **Text** icon (the letter 'A') in the top toolbar, click on the canvas, and type `SheetLang Compiler Analytics`. Set the font to **28px, Bold**.
3. Add a second text box under it: `Compilation • Performance • Reliability`. Set font to **14px, gray color**.
4. Draw a line under them using the **Line** tool (next to the Text tool).

### 4 KPI Cards (Scorecards)
1. Click **Add a chart** in the top toolbar → choose **Scorecard** (the big number).
2. Place 4 of these in a row under the header. Click each one and configure it in the **Setup** pane on the right:

| Card | Setup Pane (Metric) | How to Filter / Format |
|---|---|---|
| **Total Compilations** | Drag `Record Count` | Title it "Total Compilations" |
| **Successful Compilations**| Drag `Record Count` | Scroll down to **Filters** → Add a filter: Include `Success Status` = `Success`. |
| **Failed Compilations** | Drag `Record Count` | Scroll down to **Filters** → Add a filter: Include `Success Status` = `Failed`. |
| **Avg Compile Time** | Drag `compile_time_ms`. Change the little pencil icon on it to **Average**. | Rename the metric to "Avg Compile Time (ms)". |

*Note: For the KPI cards, go to the **Style** tab to add background colors and border radius (rounded corners) to match the Power BI instructions.*

### Compilation Activity Over Time
1. Click **Add a chart** → **Time series chart**.
2. **Dimension**: `timestamp`
3. **Metric**: `Record Count`
4. Go to the **Style** tab to change the line color and turn off gridlines.

### Success vs Failure
1. Click **Add a chart** → **Donut chart**.
2. **Dimension**: `Success Status`
3. **Metric**: `Record Count`
4. **Style**: Set the slice colors to Green (#2ECC71) for Success, and Red (#E74C3C) for Failed.

### Compile Time Trend
1. Click **Add a chart** → **Time series chart**.
2. **Dimension**: `timestamp`
3. **Metric**: `compile_time_ms` (Click the pencil to change it to **Average**).

### Recent Compilation History
1. Click **Add a chart** → **Table**.
2. **Dimension**: Add `timestamp`, `Success Status`, `error_message`.
3. **Metric**: Add `compile_time_ms`.
4. **Sort**: `timestamp` (Descending).

---

## PART 6 — Build Page 2: Compilation Analytics

1. On the top left, click **Add Page** to create a new page, and rename it `Compilation Analytics`.
2. **Compilation Count Over Time**: Add a Time Series Chart (Dim: `timestamp`, Metric: `Record Count`).
3. **Success vs Failure Trend**: Add a Time Series Chart (Dim: `timestamp`, Breakdown Dimension: `Success Status`, Metric: `Record Count`).
4. **Average Compile Time Trend**: Add a Time Series Chart (Dim: `timestamp`, Metric: Average `compile_time_ms`).
5. **Token Count Distribution**: Add a Column Chart (Dim: `token_count`, Metric: `Record Count`).
6. **Slicers (Filters)**: Click **Add a control** on the top toolbar:
   - Choose **Date range control** (for the timestamp slicer).
   - Choose **Drop-down list** and set the control field to `Success Status`.

---

## PART 7 — Build Page 3: Compiler Internals

1. Click **Add Page**, rename it `Compiler Internals`.
2. **Stage Duration Comparison**: Click **Add a chart** → **Column chart**.
   - **Dimension**: Remove it or leave blank if possible. 
   - **Metrics**: Drag all six: `lexer_ms`, `parser_ms`, `semantic_ms`, `dependency_ms`, `llvm_ms`, `execution_ms`. 
   - *Important*: Click the pencil icon on every single one of these metrics and change the aggregation to **Average**.
3. Add a **Scorecard** for `token_count` (set to Average).

---

## PART 8 — Build Page 4: Error Analysis

1. Click **Add Page**, rename it `Error Analysis`.
2. **Failures by Stage**: Add a **Bar chart**.
   - **Dimension**: `failed_stage`
   - **Metric**: `Record Count`
   - **Filter**: Add a filter where `Success Status` = `Failed`.
3. **Failure Trend**: Add a **Time series chart**.
   - **Dimension**: `timestamp`
   - **Metric**: `Record Count`
   - **Filter**: Filter where `Success Status` = `Failed`.
4. **Recent Failures Table**: Add a **Table**.
   - **Dimensions**: `timestamp`, `failed_stage`, `error_message`.
   - **Metric**: `compile_time_ms`.
   - **Filter**: Filter where `Success Status` = `Failed`.

---

## PART 9 — Final Polish

Looker Studio automatically saves your work to Google Drive, just like Google Docs. You can use the **Share** button in the top right to get a link and show the dashboard to anyone!
