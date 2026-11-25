# Major Project Report: AI-Based Coronary Artery Stenosis Detection and 3D Visualization Using Coronary Angiogram Images

**Department of Computer Science and Engineering (Data Science)**  
**PES Institute of Technology and Management (PESITM), Shivamogga**  
**Visvesvaraya Technological University (VTU), Belagavi (Academic Year 2026–2027)**

---

## 1. Directory Structure

```
Major_Project_Report/
|-- main.tex                       # Master LaTeX document combining all sections
|-- preliminary/
|   |-- title_page.tex             # Official VTU title page
|   |-- vision_mission.tex         # Institute & Department Vision and Mission
|   |-- peo_pso.tex                # Program Educational Objectives & Outcomes
|   |-- certificate.tex            # Bonafide project certificate with signatures
|   |-- declaration.tex            # Student declaration of original work
|   |-- acknowledgement.tex        # Acknowledgement of guide, HOD, and faculty
|   |-- abstract.tex               # Comprehensive executive abstract
|   `-- abbreviations.tex          # Complete list of acronyms & expansions
|-- chapters/
|   |-- chapter1_introduction.tex  # Problem statement, objectives, scope, SDGs
|   |-- chapter2_literature_review.tex # Literature survey table, existing gaps
|   |-- chapter3_methodology.tex   # System architecture, equations, algorithms
|   |-- chapter4_implementation_testing.tex # Code listings, 40-check test cases
|   |-- chapter5_results_discussion.tex # Output figures, ARCADE benchmarks
|   `-- chapter6_conclusion_future_work.tex # Summary, limitations, future work
|-- figures/                       # Radiographic plates, 3D views, cutaways
|-- tables/                        # Structured evaluation tables
|-- references/
|   `-- references.bib             # Genuine IEEE-style bibliography
|-- appendices/
|   |-- appendix_a.tex             # ARCADE dataset distribution & views
|   |-- appendix_b.tex             # UN Sustainable Development Goals mapping
|   |-- appendix_c.tex             # Research publications under preparation
|   |-- appendix_d.tex             # Institutional plagiarism screening report
|   |-- appendix_e.tex             # About the team members & responsibilities
|   `-- appendix_f.tex             # Important source code & REST API table
`-- README.md                      # Compilation and customization guide
```

---

## 2. Compilation Instructions

### Local LaTeX Compiler (TeX Live / MiKTeX / MacTeX)
Open a terminal in the `Major_Project_Report/` directory and execute:

```bash
pdflatex main.tex
bibtex main
pdflatex main.tex
pdflatex main.tex
```

### Overleaf / Cloud LaTeX Editor
1. Compress the `Major_Project_Report` directory as a ZIP file.
2. In [Overleaf](https://www.overleaf.com), select **New Project $\rightarrow$ Upload Project** and upload the ZIP.
3. Ensure the compiler is set to **pdfLaTeX** or **XeLaTeX**, with `main.tex` selected as the main document.
4. Click **Recompile**.

---

## 3. Placeholders for Final Personalization
The following details are clearly marked with brackets in the LaTeX files and can be updated prior to final submission:
- **Guide Details**: `[GUIDE NAME]` in `preliminary/title_page.tex` and `certificate.tex`.
- **HOD \& Principal Names**: `[HOD NAME]` and `[PRINCIPAL NAME]` in `certificate.tex`.
- **Team Members \& USNs**: `[TEAM MEMBER 2/3/4]` and `[USN: 4PM21CD0XX]` in `title_page.tex` and `appendix_e.tex` (Lead: *Uday Kumar Reddy Y G*, USN: *4PM21CD058*).
- **Plagiarism Digital Certificate**: Attach the official digital report screenshot in `appendices/appendix_d.tex`.
