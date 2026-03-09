import Vapor
import Foundation

/// Extension to allow encoding [String: Any] dicts directly as Vapor responses.
/// Used by controllers that return mixed-type JSON objects.
extension Dictionary where Key == String, Value == Any {
    func encodeResponse(for req: Request) async throws -> Response {
        let data = try JSONSerialization.data(withJSONObject: self, options: [])
        var headers = HTTPHeaders()
        headers.contentType = .json
        return Response(status: .ok, headers: headers, body: .init(data: data))
    }
}

extension Array where Element == [String: Any] {
    func encodeResponse(for req: Request) async throws -> Response {
        let data = try JSONSerialization.data(withJSONObject: self, options: [])
        var headers = HTTPHeaders()
        headers.contentType = .json
        return Response(status: .ok, headers: headers, body: .init(data: data))
    }
}
