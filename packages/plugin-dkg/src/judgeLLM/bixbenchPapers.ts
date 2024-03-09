export const bixbenchPapers = [
    {
        uuid: "33b801bb-9b47-4a0a-9314-05325c82fde7",
        short_id: "bix-1",
        hypothesis:
            "Truncating ASXL1 mutations will lead to specific gene expression changes in blood that reflect alterations in hematological processes, such as T cell and neutrophil activation.",
        result: "Gene ontology (GO) analysis of differentially expressed genes (DEGs) in Bohring-Opitz syndrome blood samples revealed significant enrichment for hematological processes, including T cell activation (p-adj = 3.23E-8) and neutrophil activation (p-adj = 1.90E-5). This suggests that ASXL1 mutations notably impact immune-related pathways in blood samples.",
        answer: true,
        categories:
            "['RNA-seq', 'Differential Expression Analysis', 'Transcriptomics', 'Network Biology']",
        paper: "https://doi.org/10.1172/jci.insight.167744",
        path: "/home/hackerboy/ai/eliza/bixbench/bix-1.pdf",
        questions:
            "[{'id': 'q1', 'development': '', 'question': 'What is the adjusted p-val threshold for T-cell activation related processes found in the GO enrichment?', 'ideal_answer': 'p-adj < 0.05 for T cell activation terms', 'distractor_1': 'p-adj < 0.01 for any immune process', 'distractor_2': 'raw p-value < 0.05 for T cell terms', 'distractor_3': 'log2FoldChange > 1.5 for T cell genes', 'explanation': ''}, {'id': 'q2', 'development': '', 'question': 'How many GO terms related to immune processes must show p-adj < 0.05 to establish significant enrichment of immune pathways in the dataset?', 'ideal_answer': 'At least 1 term', 'distractor_1': 'At least 10 terms', 'distractor_2': 'At least 50% of all immune-related terms', 'distractor_3': 'All immune-related terms', 'explanation': ''}, {'id': 'q3', 'development': '', 'question': 'What variable must be included in the DESeq2 design formula to properly analyze the effect of ASXL1 mutations in a mixed-gender cohort?', 'ideal_answer': 'sex', 'distractor_1': 'sample name', 'distractor_2': 'age', 'distractor_3': 'batch number', 'explanation': ''}, {'id': 'q4', 'development': '', 'question': 'What clinical feature or criterion should be used as an exclusion factor for patients recruited in the study', 'ideal_answer': 'Presence of confounding medical conditions', 'distractor_1': 'Low sequencing depth', 'distractor_2': 'Age of the patient', 'distractor_3': 'Genetic background', 'explanation': ''}, {'id': 'q6', 'development': '', 'question': 'What is the adjusted p-value for neutrophil activation in the gene ontology analysis?', 'ideal_answer': '1.90E-5', 'distractor_1': '3.23E-8', 'distractor_2': '4.56E-4', 'distractor_3': '2.15E-6', 'explanation': ''}]",
        data_folder: "CapsuleFolder-33b801bb-9b47-4a0a-9314-05325c82fde7.zip",
    },
];
