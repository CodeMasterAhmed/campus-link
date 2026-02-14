import fs from 'fs';

interface CollegeEntry {
    code: string;
    name: string;
}

export function parseCollegeList(filePath: string): CollegeEntry[] {
    const content = fs.readFileSync(filePath, 'utf-8');
    // Split by form feed character (page break)
    const pages = content.split('\f');
    const colleges: CollegeEntry[] = [];

    for (const page of pages) {
        const lines = page.split('\n').map(l => l.trim()).filter(l => l.length > 0);

        // Extract codes
        const codes: string[] = [];
        // Extract names
        // This is harder because names span multiple lines.
        // But we know the order: Codes come first (after S.No), then Names.

        // Let's try to identify the "Code" section and "Name" section.
        // Codes are 4 digits.
        // Names are text.

        // Heuristic:
        // 1. Find all 4-digit codes in the page.
        // 2. Find all college names.
        //    Names usually start with capital letters and contain "College", "Institute", "University".
        //    But names are split across lines.

        // Let's just grab all 4-digit codes first.
        for (const line of lines) {
            if (/^\d{4}$/.test(line)) {
                codes.push(line);
            }
        }

        // Now for names.
        // The names appear after the codes section?
        // In Page 1:
        // S.No
        // Code
        // Name of the College
        // Chaitanya...
        // ...
        // Vasavi...

        // So we can look for "Name of the College" header?
        // Or just look for blocks of text that are not codes, not S.No, not Course, not Intake.

        // Let's try to extract names by looking for the start of the name block.
        // It seems names are listed sequentially.
        // We have N codes, so we expect N names.

        // Let's collect all lines that are NOT codes, NOT S.No, NOT headers.
        // And try to group them.

        // Better approach for this specific file:
        // The file seems to have a specific order of columns.
        // But since it's just text, we can't be sure of boundaries.

        // However, we can see that names are usually separated by empty lines or just start of new name?
        // Actually, in the file:
        // Chaitanya ...
        // Gandipet,
        // Hyderabad.
        // 
        // Vasavi ...

        // There is an empty line between colleges!
        // So we can extract name blocks.

        // Let's try to find the "Name of the College" line, and start reading names from there.
        let nameStartIndex = lines.findIndex(l => l.includes('Name of the College'));
        // Find index of last code
        let lastCodeIndex = -1;
        for (let i = 0; i < lines.length; i++) {
            if (/^\d{4}$/.test(lines[i])) {
                lastCodeIndex = i;
            }
        }

        // If no header, assume names start after the last code
        if (nameStartIndex === -1 && lastCodeIndex !== -1) {
            nameStartIndex = lastCodeIndex;
        }

        if (nameStartIndex !== -1) {
            // We have a start point.

            // Find index of first Course line
            const firstCourseIndex = lines.findIndex((l, i) => i > lastCodeIndex && (l.startsWith('B.E.') || l.startsWith('M.E.') || l.startsWith('M.Tech')));

            if (lastCodeIndex !== -1 && firstCourseIndex !== -1) {
                const nameLines = lines.slice(nameStartIndex + 1, firstCourseIndex);
                // Now we need to split nameLines into N blocks, where N = codes.length.
                // The separator seems to be implicit or maybe based on "Hyderabad" or "District"?
                // Or maybe just empty lines in the original content?
                // But we did split('\n') and filtered empty lines.

                // Let's use the original page content (preserving empty lines) to split names.
                // Find where names start and end in rawLines
                // This is getting complicated.

                // Alternative:
                // Just map codes to names based on order.
                // We have `codes`.
                // We have `nameLines`.
                // `nameLines` contains all the text for names.
                // We need to group them.
                // "Chaitanya ... Hyderabad."
                // "Vasavi ... Hyderabad"

                // It seems every college address ends with "Hyderabad." or "District.".
                // We can use that as a delimiter?

                let currentName = '';
                const names: string[] = [];

                for (const line of nameLines) {
                    // Skip "Name of the College" header
                    if (line.includes('Name of the College')) continue;

                    currentName += (currentName ? ' ' : '') + line;

                    if (line.endsWith('.') || line.endsWith('Hyderabad') || line.endsWith('District')) {
                        // End of address?
                        // "Hyderabad."
                        // "Ranga Reddy District."
                        // "Hyderabad"

                        // But some lines might end with "." inside?
                        // "St. Mary's"

                        // Let's assume if it ends with "Hyderabad." or "District." or "Hyderabad" it is the end.
                        if (line.toLowerCase().includes('hyderabad') || line.toLowerCase().includes('district') || line.toLowerCase().includes('medak')) {
                            names.push(currentName);
                            currentName = '';
                        }
                    }
                }

                // If we have leftover
                if (currentName) {
                    names.push(currentName);
                }

                // Now pair them
                for (let i = 0; i < Math.min(codes.length, names.length); i++) {
                    colleges.push({ code: codes[i], name: names[i] });
                }
            }
        }
    }

    return colleges;
}
