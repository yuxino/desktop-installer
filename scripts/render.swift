// Author the installer sidebars once on macOS. Windows consumes the lossless BMPs.
// swift scripts/render.swift <repository-root> <product-id> <display-name>
import AppKit

let args = CommandLine.arguments
precondition(args.count == 5, "Expected repository root, product ID, display name, and publisher")
let folder = URL(fileURLWithPath: args[1]).appendingPathComponent("assets/\(args[2])")
guard let portrait = NSImage(contentsOf: folder.appendingPathComponent("portrait.png")),
      let bitmap = NSBitmapImageRep(bitmapDataPlanes: nil, pixelsWide: 656, pixelsHigh: 1256,
        bitsPerSample: 8, samplesPerPixel: 4, hasAlpha: true, isPlanar: false,
        colorSpaceName: .deviceRGB, bytesPerRow: 656 * 4, bitsPerPixel: 32),
      let context = NSGraphicsContext(bitmapImageRep: bitmap) else { fatalError("Missing artwork") }
NSGraphicsContext.saveGraphicsState()
NSGraphicsContext.current = context
context.imageInterpolation = .high
NSColor.white.setFill()
NSRect(x: 0, y: 0, width: 656, height: 1256).fill()
// Fit the complete half-body portrait without clipping hair, hands, or props.
let area = NSRect(x: 12, y: 126, width: 632, height: 982)
let scale = min(area.width / portrait.size.width, area.height / portrait.size.height)
let size = NSSize(width: portrait.size.width * scale, height: portrait.size.height * scale)
portrait.draw(in: NSRect(x: area.midX - size.width / 2, y: area.midY - size.height / 2,
    width: size.width, height: size.height), from: .zero, operation: .sourceOver, fraction: 1)
func text(_ value: String, size: CGFloat, weight: NSFont.Weight, color: CGFloat, y: CGFloat) {
    let attrs: [NSAttributedString.Key: Any] = [.font: NSFont.systemFont(ofSize: size, weight: weight),
        .foregroundColor: NSColor(calibratedWhite: color, alpha: 1)]
    (value as NSString).draw(at: NSPoint(x: 48, y: y), withAttributes: attrs)
}
// Proper names only; all welcome/thanks/Star copy remains native localized text.
text(args[3], size: 66, weight: .semibold, color: 0.19, y: 1130)
text(args[4], size: 30, weight: .medium, color: 0.48, y: 52)
NSGraphicsContext.restoreGraphicsState()
try bitmap.representation(using: .png, properties: [:])!.write(to: folder.appendingPathComponent("sidebar.png"))
