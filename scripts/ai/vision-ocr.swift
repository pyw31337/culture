// Apple Vision 한글 글자 인식 (맥미니 전용, 무료·오프라인). camp/local/macmini/vision-ocr.swift를 바탕으로
// 공연 소개 이미지처럼 아주 긴 세로 이미지를 잘라서 읽도록 했다. Vision은 큰 이미지를 줄여서 읽기 때문에
// 800×12000 같은 이미지를 통째로 넘기면 글자가 뭉개진다.
// 컴파일: swiftc -O scripts/ai/vision-ocr.swift -o .cache/ai/vision-ocr  (extract-intro-images.ts가 알아서 한다)
// 사용:  vision-ocr <그림 경로> [최대 조각 수]  → {"rows":["출연  김OO  이OO", ...], "tiles": 6}
import Foundation
import ImageIO
import Vision

func emit(_ obj: [String: Any]) {
  let data = (try? JSONSerialization.data(withJSONObject: obj)) ?? Data("{}".utf8)
  FileHandle.standardOutput.write(data)
  FileHandle.standardOutput.write(Data("\n".utf8))
}

let args = CommandLine.arguments
guard args.count >= 2,
      let src = CGImageSourceCreateWithURL(URL(fileURLWithPath: args[1]) as CFURL, nil),
      let image = CGImageSourceCreateImageAtIndex(src, 0, nil) else {
  FileHandle.standardError.write(Data("usage: vision-ocr <image> [maxTiles]\n".utf8))
  exit(1)
}
let maxTiles = args.count >= 3 ? max(1, Int(args[2]) ?? 12) : 12

// 세로로 긴 이미지는 폭의 1.5배 높이로 자르고, 줄이 잘리지 않게 조금씩 겹친다.
let width = image.width
let height = image.height
let tileHeight = max(1, Int(Double(width) * 1.5))
let overlap = Int(Double(tileHeight) * 0.06)
var tiles: [CGRect] = []
if height <= tileHeight * 2 {
  tiles = [CGRect(x: 0, y: 0, width: width, height: height)]
} else {
  var y = 0
  while y < height && tiles.count < maxTiles {
    let h = min(tileHeight, height - y)
    tiles.append(CGRect(x: 0, y: y, width: width, height: h))
    if y + h >= height { break }
    y += h - overlap
  }
}

func readRows(_ cg: CGImage) -> [String] {
  let request = VNRecognizeTextRequest()
  request.recognitionLevel = .accurate
  request.usesLanguageCorrection = true
  if #available(macOS 13.0, *) {
    request.revision = VNRecognizeTextRequestRevision3
    request.recognitionLanguages = ["ko-KR", "en-US"]
  }
  do { try VNImageRequestHandler(cgImage: cg, options: [:]).perform([request]) } catch { return [] }

  // 글 덩어리 → 줄. Vision 좌표는 왼쪽 아래가 원점(0~1). 위에서 아래로, 같은 줄은 왼쪽에서 오른쪽으로.
  let items: [(String, CGRect)] = (request.results ?? []).compactMap { o in
    guard let best = o.topCandidates(1).first else { return nil }
    return (best.string, o.boundingBox)
  }
  let heights = items.map { $0.1.height }.sorted()
  let tol = (heights.isEmpty ? 0.02 : heights[heights.count / 2]) * 0.6
  var rows: [[(String, CGRect)]] = []
  for it in items.sorted(by: { $0.1.midY > $1.1.midY }) {
    if let ref = rows.last?.first, abs(ref.1.midY - it.1.midY) < tol {
      rows[rows.count - 1].append(it)
    } else {
      rows.append([it])
    }
  }
  return rows.map { $0.sorted(by: { $0.1.minX < $1.1.minX }).map { $0.0 }.joined(separator: "  ") }
}

var lines: [String] = []
for rect in tiles {
  guard let cg = image.cropping(to: rect) else { continue }
  for row in readRows(cg) where lines.last != row {
    lines.append(row)
  }
}
emit(["rows": lines, "tiles": tiles.count, "width": width, "height": height])
