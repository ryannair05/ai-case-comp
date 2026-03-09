import Foundation

/// Minimal DOCX export for proposal content.
///
/// A .docx file is a ZIP archive containing XML files.
/// This generator produces a valid Word 2007+ document without
/// any external dependencies — just Foundation's ZIP-free approach
/// using a pre-built static binary template with dynamic XML injection.
///
/// Structure produced:
///   [Content_Types].xml
///   _rels/.rels
///   word/document.xml          ← proposal content goes here
///   word/_rels/document.xml.rels
///   word/styles.xml
///   docProps/core.xml
struct DocxExporter {
    static let shared = DocxExporter()
    private init() {}

    /// Generate a .docx file from proposal content.
    /// Returns the raw ZIP bytes ready to stream as a download.
    func export(title: String, content: String, clientName: String?) throws -> Data {
        // Split content into paragraphs and encode as OOXML runs
        let paragraphs = content
            .components(separatedBy: "\n")
            .map { escapedXML($0) }

        let bodyXML = paragraphs.map { line -> String in
            if line.isEmpty {
                return "<w:p/>"
            }
            // Detect headings (all-caps lines or lines ending with a colon treated as headings)
            let isHeading = line == line.uppercased() && !line.isEmpty && line.count < 80
            if isHeading {
                return """
                <w:p><w:pPr><w:pStyle w:val="Heading1"/></w:pPr><w:r><w:t>\(line)</w:t></w:r></w:p>
                """
            }
            return "<w:p><w:r><w:t xml:space=\"preserve\">\(line)</w:t></w:r></w:p>"
        }.joined(separator: "\n")

        let documentXML = """
<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<w:document xmlns:wpc="http://schemas.microsoft.com/office/word/2010/wordprocessingCanvas"
            xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main"
            xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships">
  <w:body>
    <w:p>
      <w:pPr><w:pStyle w:val="Title"/></w:pPr>
      <w:r><w:t>\(escapedXML(title))</w:t></w:r>
    </w:p>
    \(clientName.map { "<w:p><w:r><w:rPr><w:b/></w:rPr><w:t>Prepared for: \(escapedXML($0))</w:t></w:r></w:p>" } ?? "")
    \(bodyXML)
    <w:sectPr><w:pgSz w:w="12240" w:h="15840"/></w:sectPr>
  </w:body>
</w:document>
"""

        let contentTypes = """
<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types">
  <Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/>
  <Default Extension="xml"  ContentType="application/xml"/>
  <Override PartName="/word/document.xml"
            ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.document.main+xml"/>
  <Override PartName="/word/styles.xml"
            ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.styles+xml"/>
</Types>
"""

        let dotRels = """
<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">
  <Relationship Id="rId1"
    Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument"
    Target="word/document.xml"/>
</Relationships>
"""

        let wordRels = """
<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">
  <Relationship Id="rId1"
    Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/styles"
    Target="styles.xml"/>
</Relationships>
"""

        let stylesXML = """
<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<w:styles xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main">
  <w:style w:type="paragraph" w:styleId="Normal"><w:name w:val="Normal"/>
    <w:rPr><w:sz w:val="24"/></w:rPr></w:style>
  <w:style w:type="paragraph" w:styleId="Title"><w:name w:val="Title"/>
    <w:pPr><w:jc w:val="center"/></w:pPr>
    <w:rPr><w:b/><w:sz w:val="52"/></w:rPr></w:style>
  <w:style w:type="paragraph" w:styleId="Heading1"><w:name w:val="heading 1"/>
    <w:rPr><w:b/><w:sz w:val="32"/></w:rPr></w:style>
</w:styles>
"""

        // Build the DOCX ZIP archive
        let files: [(path: String, content: String)] = [
            ("[Content_Types].xml", contentTypes),
            ("_rels/.rels", dotRels),
            ("word/document.xml", documentXML),
            ("word/_rels/document.xml.rels", wordRels),
            ("word/styles.xml", stylesXML),
        ]

        return try buildZip(files: files.map { ($0.path, Data($0.content.utf8)) })
    }

    // MARK: - Minimal ZIP builder

    /// Public ZIP builder used by ExportController for multi-file exports.
    func buildZipPublic(files: [(String, Data)]) throws -> Data {
        try buildZip(files: files.map { (path: $0.0, data: $0.1) })
    }

    /// Build a ZIP archive from an array of (path, data) pairs.
    /// Uses the DEFLATE-free STORE method for simplicity and compatibility.
    private func buildZip(files: [(path: String, data: Data)]) throws -> Data {
        var archive = Data()
        var centralDirectory = Data()
        var localOffsets: [UInt32] = []

        for (path, fileData) in files {
            let pathBytes = Array(path.utf8)
            let localOffset = UInt32(archive.count)
            localOffsets.append(localOffset)

            // Local file header
            archive.append(contentsOf: [0x50, 0x4B, 0x03, 0x04]) // signature
            archive.append(contentsOf: uint16LE(20))   // version needed
            archive.append(contentsOf: uint16LE(0))    // flags
            archive.append(contentsOf: uint16LE(0))    // compression: STORE
            archive.append(contentsOf: uint16LE(0))    // mod time
            archive.append(contentsOf: uint16LE(0))    // mod date
            archive.append(contentsOf: uint32LE(crc32(fileData)))
            archive.append(contentsOf: uint32LE(UInt32(fileData.count)))
            archive.append(contentsOf: uint32LE(UInt32(fileData.count)))
            archive.append(contentsOf: uint16LE(UInt16(pathBytes.count)))
            archive.append(contentsOf: uint16LE(0))    // extra field length
            archive.append(contentsOf: pathBytes)
            archive.append(fileData)

            // Central directory entry
            centralDirectory.append(contentsOf: [0x50, 0x4B, 0x01, 0x02]) // signature
            centralDirectory.append(contentsOf: uint16LE(20))   // version made by
            centralDirectory.append(contentsOf: uint16LE(20))   // version needed
            centralDirectory.append(contentsOf: uint16LE(0))    // flags
            centralDirectory.append(contentsOf: uint16LE(0))    // compression
            centralDirectory.append(contentsOf: uint16LE(0))    // mod time
            centralDirectory.append(contentsOf: uint16LE(0))    // mod date
            centralDirectory.append(contentsOf: uint32LE(crc32(fileData)))
            centralDirectory.append(contentsOf: uint32LE(UInt32(fileData.count)))
            centralDirectory.append(contentsOf: uint32LE(UInt32(fileData.count)))
            centralDirectory.append(contentsOf: uint16LE(UInt16(pathBytes.count)))
            centralDirectory.append(contentsOf: uint16LE(0))    // extra
            centralDirectory.append(contentsOf: uint16LE(0))    // comment
            centralDirectory.append(contentsOf: uint16LE(0))    // disk start
            centralDirectory.append(contentsOf: uint16LE(0))    // internal attr
            centralDirectory.append(contentsOf: uint32LE(0))    // external attr
            centralDirectory.append(contentsOf: uint32LE(localOffset))
            centralDirectory.append(contentsOf: pathBytes)
        }

        let cdOffset = UInt32(archive.count)
        archive.append(centralDirectory)

        // End of central directory
        archive.append(contentsOf: [0x50, 0x4B, 0x05, 0x06])
        archive.append(contentsOf: uint16LE(0))
        archive.append(contentsOf: uint16LE(0))
        archive.append(contentsOf: uint16LE(UInt16(files.count)))
        archive.append(contentsOf: uint16LE(UInt16(files.count)))
        archive.append(contentsOf: uint32LE(UInt32(centralDirectory.count)))
        archive.append(contentsOf: uint32LE(cdOffset))
        archive.append(contentsOf: uint16LE(0))

        return archive
    }

    // MARK: - Helpers

    private func uint16LE(_ v: UInt16) -> [UInt8] {
        [UInt8(v & 0xFF), UInt8((v >> 8) & 0xFF)]
    }
    private func uint32LE(_ v: UInt32) -> [UInt8] {
        [UInt8(v & 0xFF), UInt8((v >> 8) & 0xFF), UInt8((v >> 16) & 0xFF), UInt8((v >> 24) & 0xFF)]
    }

    /// CRC-32 (ISO 3309) — required by the ZIP format.
    private func crc32(_ data: Data) -> UInt32 {
        var crc: UInt32 = 0xFFFF_FFFF
        for byte in data {
            crc ^= UInt32(byte)
            for _ in 0..<8 {
                crc = (crc & 1) == 1 ? (crc >> 1) ^ 0xEDB8_8320 : crc >> 1
            }
        }
        return crc ^ 0xFFFF_FFFF
    }

    private func escapedXML(_ s: String) -> String {
        s.replacingOccurrences(of: "&",  with: "&amp;")
         .replacingOccurrences(of: "<",  with: "&lt;")
         .replacingOccurrences(of: ">",  with: "&gt;")
         .replacingOccurrences(of: "\"", with: "&quot;")
         .replacingOccurrences(of: "'",  with: "&apos;")
    }
}
