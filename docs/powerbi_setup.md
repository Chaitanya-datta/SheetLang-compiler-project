# Power BI Integration Guide

## PART 1 — Installation

1. Go to **[powerbi.microsoft.com/desktop](https://powerbi.microsoft.com/desktop)**
2. Click **"Download free"**
3. Run the downloaded installer, click through with default options (Next → Next → Install)
4. Once installed, open **Power BI Desktop**

## PART 2 — Skip sign-in

- If it shows a sign-in screen, look for **"Skip"**, an **X** in the corner, or **"Continue without signing in"**.
- **You do NOT need a Microsoft account** to build and save a report locally. Click past this screen.

## PART 3 — Load the CSV data

1. On the main "Get Data" screen (or **Home** tab → **Get Data**), choose **Text/CSV**.
2. Browse to wherever you saved `sheetlang_compilations.csv` (this can be exported from the backend `/api/export/csv` endpoint).
3. A preview window pops up — click **Load** directly (no need to click "Transform Data" yet).

## PART 4 — Fix the timestamp column type (important, do this before charts)

1. On the left sidebar, click the **Table view** icon (looks like a small grid/table icon, second icon down).
2. Click the `timestamp` column header at the top of the table.
3. In the ribbon that appears (**Column tools** tab), find **Data type** dropdown → change it to **Date/Time**.
4. If it shows errors or blank values after this:
   - Go to **Home** tab → **Transform data** (this opens the Power Query Editor in a new window)
   - Click the small `ABC` icon at the top of the `timestamp` column
   - From the dropdown, choose **Date/Time**
   - Click **Close & Apply** (top left) to save and return to the main view

## PART 5 — Clean up the "success" column (makes charts more readable)

Right now, `success` is `1` or `0` — let's turn that into readable text:

1. **Home** tab → **Transform data** (opens Power Query Editor again).
2. Click on the `success` column.
3. Go to **Transform** tab → **Replace Values**.
4. Value to Find: `1` → Replace With: `Success` → click OK.
5. Repeat: **Replace Values** again, Value to Find: `0` → Replace With: `Failed` → OK.
6. Click **Close & Apply**.

Now this column will show "Success"/"Failed" everywhere instead of 1/0 — much more presentable in charts and legends.

## PART 6 — Set the visual theme (do this before adding any charts)

1. Go to the **View** tab (top ribbon).
2. Click **Themes** → browse the options → pick a clean one like **"Slate"** (dark, professional) or **"Executive"**. Avoid the plain default — it looks generic.
3. Click anywhere on the blank canvas (nothing selected) → in the **Format** pane (paint-roller icon) on the right → **Page size** → choose **16:9 Standard**. Do this for every page you create later, for consistency.

---

## PART 7 — Build Page 1: Executive Overview

### Header
1. Rename the page: double-click the **"Page 1"** tab at the bottom → type `Executive Overview`, press Enter.
2. **Insert** tab → **Text box** → click on canvas, type `SheetLang Compiler Analytics`.
   - Select the text, set font size **28**, **Bold**.
3. **Insert → Text box** again, just below the first → type `Compilation • Performance • Reliability`.
   - Font size **13**, lighter/gray color, regular weight.
4. **Insert → Shapes → Rectangle**, draw a thin horizontal line just under both text boxes as a divider (make it full width, ~2px tall, light gray fill).

### 4 KPI Cards
Repeat this 4 times:

1. Click empty canvas area.
2. In the **Visualizations** pane (right side), click the **Card** icon (single big number).
3. Drag the correct field into the **Fields** well (see table below).
4. Format each card (Format pane, paint-roller icon):
   - **Callout value**: font size 32, bold
   - **Category label**: font size 11 (type the label text in CAPS manually since it won't auto-capitalize)
   - **Background**: turn on, pick a subtle dark/light fill depending on theme; **Border → Rounded corners**, radius ~8

| Card | Field to drag | Aggregation (right-click the field in the well) | Extra step |
|---|---|---|---|
| Total Compilations | `id` | Count | — |
| Success Rate | `success`... **wait** | — | See note below |
| Failed Compilations | `id` | Count | Add filter: drag `success` into the **Filters** pane, set to "Failed" |
| Avg Compile Time | `compile_time_ms` | Average | Add a small text box next to it saying "ms" |

**Note on Success Rate**: since we converted `success` to text ("Success"/"Failed"), you can't average it directly anymore. Instead:
- Drag `id` into the card, set aggregation to **Count**
- Add a **Filter**: drag `success` into Filters pane, set to "Success" only
- This card now shows "count of successful compilations" — label it "Successful Compilations" instead of "Success Rate", OR for a true percentage, create a simple measure: **Modeling** tab → **New Measure**, type:
  ```
  Success Rate = DIVIDE(CALCULATE(COUNTROWS('sheetlang_compilations'), 'sheetlang_compilations'[success] = "Success"), COUNTROWS('sheetlang_compilations'))
  ```
  Then drag this new measure into the card instead, and format it as a percentage (Format pane → set to Percentage, 1 decimal).

Arrange all 4 cards in a single row, same height/width, directly below the header divider.

### Compilation Activity Over Time
1. Select **Line chart** from Visualizations.
2. X-axis: drag `timestamp`. Y-axis: drag `id`, set to **Count**.
3. Format: Title = "Compilation Activity Over Time" (bold, 14pt); turn off X-axis gridlines; keep Y-axis gridlines light gray; pick one accent color for the line.

### Success vs Failure
1. Select **Donut chart**.
2. Legend: drag `success`. Values: drag `id`, set to **Count**.
3. Format → Data colors: set "Success" to green (`#2ECC71`), "Failed" to red (`#E74C3C`).
4. Title: "Success vs Failure"

### Compile Time Trend
1. Select **Line chart**.
2. X-axis: `timestamp`. Y-axis: `compile_time_ms`, set to **Average**.
3. Title: "Compile Time Trend (ms)"

### Recent Compilation History
1. Select **Table**.
2. Add columns in this order: `timestamp`, `success`, `compile_time_ms`, `error_message`.
3. Format → Grid → turn on **Row banding**. Sort by clicking the `timestamp` header until newest is on top.

### Layout
Arrange top to bottom: Title/subtitle → 4 KPI cards in a row → Line chart + Donut chart side by side → Compile Time Trend (full width) → Table at bottom. Keep consistent small gaps, nothing touching edges.

---

## PART 8 — Build Page 2: Compilation Analytics

1. Click **+** at bottom to add new page, rename `Compilation Analytics`.
2. Copy-paste the title/subtitle text boxes from Page 1 (select them on Page 1, Ctrl+C, go to Page 2, Ctrl+V) — just edit the text if needed, keeps styling consistent.
3. **Compilation Count Over Time**: Line chart, X=`timestamp`, Y=`id` (Count).
4. **Success vs Failure Trend**: Line chart, X=`timestamp`, Legend=`success`, Y=`id` (Count) — this shows two lines over time.
5. **Average Compile Time Trend**: Line chart, X=`timestamp`, Y=`compile_time_ms` (Average).
6. **Token Count Distribution**: Column chart, Axis=`token_count`, Values=`id` (Count).
7. **Slicers**: add two **Slicer** visuals, stack vertically on the left:
   - One with `timestamp` dragged in (date range filter)
   - One with `success` dragged in (Success/Failed checkbox list)
8. Arrange the 4 charts in a 2×2 grid on the right, slicers on the left edge.

---

## PART 9 — Build Page 3: Compiler Internals

1. New page, rename `Compiler Internals`. Copy the header text boxes again.
2. **Stage Duration Comparison**: Clustered column chart.
   - Drag ALL SIX into **Values**: `lexer_ms`, `parser_ms`, `semantic_ms`, `dependency_ms`, `llvm_ms`, `execution_ms` — right-click each in the well, set to **Average**.
   - Make this chart large — the centerpiece of the page.
   - Title: "Average Time per Compiler Stage (ms)"
3. Add a **Card** for `token_count` set to **Average**, label "Average Token Count".

---

## PART 10 — Build Page 4: Error Analysis

1. New page, rename `Error Analysis`. Copy the header.
2. **Failures by Stage**: select **Bar chart** (horizontal, not Column).
   - Axis: `failed_stage`, Values: `id` (Count)
   - Filters pane: drag `success`, set filter to "Failed" only
   - Set bar colors to red/amber tones
3. **Failure Trend Over Time**: Line chart, X=`timestamp`, Y=`id` (Count), filtered to `success = Failed`.
4. **Recent Failed Compilations** (Table): columns `timestamp`, `failed_stage`, `error_message`, `compile_time_ms`, filtered to `success = Failed`, sorted newest first.

---

## PART 11 — Final polish (do this last, across all 4 pages)

1. **Align things properly**: select multiple visuals (hold Shift, click each) → **Format** tab (top ribbon, not the pane) → **Align** → Align left/top, or **Distribute** → makes everything snap into a neat grid instead of freehand placement.
2. **Consistent fonts everywhere**: Titles=28, page headers if any=14 bold, chart titles=14 bold, labels/body=11-12, KPI numbers=32 bold. Don't let font sizes vary randomly between pages.
3. **Remove clutter**: for each visual, Format pane → General → turn off unnecessary borders/shadows if your theme already provides clean backgrounds.
4. **Add page navigation buttons** (optional but impressive): **Insert → Buttons → Blank** → place small buttons at the top of each page → select a button → **Format → Action** → turn on, set Type to **Page navigation**, pick the target page. Do this for all 4 pages so you can click between them like a real app.
5. **Save**: **File → Save As** → name it `SheetLang_Analytics.pbix`, save somewhere easy to find.
