//
//  TRPCClient.swift
//  Generated by trpc-swift
//  Library Author: Marko Calasan
//

import Foundation

public enum DecodableValue: Decodable {
    case string(String)
    case int(Int)
    case double(Double)
    case bool(Bool)
    case dictionary([String: DecodableValue])
    case array([DecodableValue])
    
    public init(from decoder: Decoder) throws {
        let container = try decoder.singleValueContainer()
        if let str = try? container.decode(String.self) {
            self = .string(str)
        } else if let int = try? container.decode(Int.self) {
            self = .int(int)
        } else if let dbl = try? container.decode(Double.self) {
            self = .double(dbl)
        } else if let bool = try? container.decode(Bool.self) {
            self = .bool(bool)
        } else if let array = try? container.decode([DecodableValue].self) {
            self = .array(array)
        } else {
            let dict = try container.decode([String: DecodableValue].self)
            self = .dictionary(dict)
        }
    }
}

public enum TRPCErrorCode: Int, Codable {
    // tRPC Defined
    case parseError = -32700
    case badRequest = -32600
    case internalServerError = -32603
    case unauthorized = -32001
    case forbidden = -32003
    case notFound = -32004
    case methodNotSupported = -32005    
    case timeout = -32008
    case conflict = -32009
    case preconditionFailed = -32012
    case payloadTooLarge = -32013
    case unprocessableContent = -32022
    case tooManyRequests = -32029
    case clientClosedRequest = -32099
    
    // Application Defined
    case unknown = -1
    case missingOutputPayload = -2
    case errorParsingUrl = -3
    case errorParsingUrlComponents = -4
    case unicodeDecodingError = -5
}

public struct TRPCError: Error, Decodable {
    public let code: TRPCErrorCode
    public let message: String?
    public let data: DecodableValue?
    
    init(code: TRPCErrorCode, message: String? = nil, data: DecodableValue? = nil) {
        self.code = code
        self.message = message
        self.data = data
    }
}

struct TRPCBatchRequest<T: Encodable>: Encodable {
    let zero: T

    enum CodingKeys: String, CodingKey {
        case zero = "0"
    }
}

struct TRPCResponse<T: Decodable>: Decodable {
    struct Result: Decodable {
        let data: T?
    }
    
    let result: Result?
    let error: TRPCError?
}

public struct TRPCSwiftFile: Equatable, Hashable {
    let filename: String
    let content: Data
    let mimeType: String

    public init(mimeType: String, content: Data, filename: String = UUID().uuidString) {
        self.mimeType = mimeType
        self.content = content
        self.filename = filename
    }
}

protocol TRPCSwiftMultipartParsable {
    var jsonFields: [String: Encodable?] { get }
    var fileFields: [String: TRPCSwiftFile?] { get }
}

public typealias TRPCMiddleware = (URLRequest) async throws -> URLRequest

enum TRPCProcedureType {
    case query
    case mutation
    case subscription

    var isBatchingStream: Bool {
        self == .query || self == .mutation
    }
}

class TRPCClient {
    static var encoder: JSONEncoder = {
        let encoder = JSONEncoder()
        encoder.dateEncodingStrategy = .formatted(dateFormatter)
        return encoder
    }()

    static var decoder: JSONDecoder = {
        let decoder = JSONDecoder()
        decoder.dateDecodingStrategy = .formatted(dateFormatter)
        return decoder
    }()

    class SSEClient<TYield: Decodable, TReturn: Decodable>: NSObject, URLSessionDataDelegate {
        
        let procedureType: TRPCProcedureType
        let onMessage: (TYield) throws -> Void
        let onClose: (Result<TReturn, Error>) -> Void

        private var task: URLSessionDataTask?
        private var didClose = false
        
        init(request: URLRequest, procedureType: TRPCProcedureType, onMessage: @escaping (TYield) throws -> Void, onClose: @escaping (Result<TReturn, Error>) -> Void) {
            self.onMessage = onMessage
            self.procedureType = procedureType
            self.onClose = onClose

            super.init()
            let config = URLSessionConfiguration.default
            let session = URLSession(configuration: config, delegate: self, delegateQueue: OperationQueue())
            self.task = session.dataTask(with: request)
        }
        
        func start() {
            task?.resume()
        }
        
        func stop() {
            task?.cancel()
        }

        private func stop(result: Result<TReturn, Error>) {
            self.didClose = true
            self.onClose(result)
            task?.cancel()
        }

        func parseSubscriptionEventLines(eventLines: [String]) {
            let dataPrefix = "data: "
            let isErrorEvent = eventLines.contains("event: serialized-error")

            for line in eventLines {
                if line.hasPrefix(dataPrefix) {
                    let jsonString = String(line[line.index(line.startIndex, offsetBy: dataPrefix.count)...])
                    do {
                        guard let jsonData = jsonString.data(using: .utf8) else {
                            throw TRPCError(code: .unicodeDecodingError)
                        }

                        if isErrorEvent {
                            let error = try decoder.decode(TRPCError.self, from: jsonData)
                            throw error
                        } else {
                            do {
                                let response = try decoder.decode(TYield.self, from: jsonData)
                                try self.onMessage(response)
                            } catch {
                                let response = try decoder.decode(TReturn.self, from: jsonData)
                                self.stop(result: .success(response))
                            }
                        }
                    } catch {
                        self.stop(result: .failure(error))
                    }
                }
            }
        }

        func parseBatchEventLines(eventLines: [String]) {
            let returnCode = 0
            let yieldCode = 1
            let errorCode = 2

            let prefixRegex = try! NSRegularExpression(pattern: "\\[[3-4],[0-2],")
            
            for line in eventLines {
                if prefixRegex.firstMatch(in: line, range: NSRange(location: 0, length: line.utf16.count)) != nil {
                    let codeIndex = line.index(line.startIndex, offsetBy: 3)
                    
                    guard let code = Int(line[codeIndex...codeIndex]) else {
                        continue
                    }
                    
                    guard let jsonStartIndex = line.firstIndex(of: "{"), let jsonEndIndex = line.lastIndex(of: "}") else {
                        continue
                    }
                    
                    guard jsonStartIndex < jsonEndIndex else {
                        continue
                    }

                    let jsonString = String(line[jsonStartIndex...jsonEndIndex])

                    guard let jsonData = jsonString.data(using: .utf8) else {
                        continue
                    }

                    do {
                        switch code {
                        case returnCode:
                            let response = try decoder.decode(TReturn.self, from: jsonData)
                            self.stop(result: .success(response))
                        case yieldCode:
                            let response = try decoder.decode(TYield.self, from: jsonData)
                            try self.onMessage(response)
                        case errorCode:
                            let error = try decoder.decode(TRPCError.self, from: jsonData)
                            throw error
                        default:
                            throw TRPCError(code: .unknown, message: "Unknown code \(code) in batch response.")
                        }
                    } catch {
                        self.stop(result: .failure(error))
                    }

                    break
                }
            }
        }
        
        func urlSession(_ session: URLSession, dataTask: URLSessionDataTask, didReceive data: Data) {
            guard let eventString = String(data: data, encoding: .utf8) else {
                return
            }
            
            let eventLines = eventString.components(separatedBy: "\n")

            if procedureType.isBatchingStream {
                parseBatchEventLines(eventLines: eventLines)
            } else {
                parseSubscriptionEventLines(eventLines: eventLines)
            }
        }

        func urlSession(_ session: URLSession, task: URLSessionTask, didCompleteWithError error: Error?) {
            guard !didClose else {
                return
            }
            didClose = true
            
            if let error = error, (error as NSError).code != NSURLErrorCancelled {
                self.onClose(.failure(error))
            } else {
                self.onClose(TReturn.self == EmptyObject.self ? .success(EmptyObject() as! TReturn) : .failure(TRPCError(code: .missingOutputPayload, message: "Missing output payload.", data: nil)))
            }
        }
    }

    struct EmptyObject: Codable { }
    
    static var dateFormatter: DateFormatter = {
        let formatter = DateFormatter()
        formatter.locale = Locale(identifier: "en_US_POSIX")
        formatter.dateFormat = "yyyy-MM-dd'T'HH:mm:ss.SSSZ"
        formatter.timeZone = TimeZone(secondsFromGMT: 0)
        
        return formatter
    }()
    
    static func sendQuery<Request: Encodable, Response: Decodable>(url: URL, middlewares: [TRPCMiddleware], input: Request) async throws -> Response {
        let urlWithParams = try createURLWithParameters(url: url, input: input)
        return try await send(url: urlWithParams, httpMethod: "GET", middlewares: middlewares, contentType: "application/json", bodyData: nil)
    }
    
    static func sendMutation<Request: Encodable, Response: Decodable>(url: URL, middlewares: [TRPCMiddleware], input: Request) async throws -> Response {
        let data = try encoder.encode(Request.self == EmptyObject.self ? nil : input)
        
        return try await send(url: url, httpMethod: "POST", middlewares: middlewares, contentType: "application/json", bodyData: data)
    }

    static func sendMultipartMutation<Request: TRPCSwiftMultipartParsable, Response: Decodable>(url: URL, middlewares: [TRPCMiddleware], input: Request) async throws -> Response {
        let boundary = "TRPCSwiftMultipart-\(UUID().uuidString)"
        let data = try createMultipartData(input: input, boundary: boundary)
        return try await send(url: url, httpMethod: "POST", middlewares: middlewares, contentType: "multipart/form-data; boundary=\(boundary)", bodyData: data)
    }
    
    static func startListener<Request: Encodable, Yield: Decodable, Return: Decodable>(url: URL, middlewares: [TRPCMiddleware], procedureType: TRPCProcedureType, input: Request, idleTimeout: TimeInterval, onMessage: @escaping (Yield) throws -> Void) async throws -> Return{
        guard let processedUrl = procedureType.isBatchingStream ? URL(string: "\(url.absoluteString)?batch=1") : try createURLWithParameters(url: url, input: input) else {
            throw TRPCError(code: .errorParsingUrl, message: "Could not create URL with parameters.")
        }

        let bodyData = procedureType.isBatchingStream ? try encoder.encode(TRPCBatchRequest(zero: input)) : nil

        var request = URLRequest(url: processedUrl)
        request.httpMethod = procedureType == .mutation ? "POST" : "GET"
        request.addValue("application/json", forHTTPHeaderField: "Content-Type")

        if procedureType.isBatchingStream {
            request.addValue("application/jsonl", forHTTPHeaderField: "trpc-accept")
        }
        
        request.httpBody = bodyData
        request.timeoutInterval = idleTimeout
        for middleware in middlewares {
            request = try await middleware(request)
        }

        return try await withCheckedThrowingContinuation { (continuation: CheckedContinuation<Return, Error>) in
            let client = SSEClient<Yield, Return>(request: request, procedureType: procedureType) { response in
                try onMessage(response)
            } onClose: { result in
                switch result {
                case .success(let value):
                    continuation.resume(returning: value)
                case .failure(let error):
                    continuation.resume(throwing: error)
                }
            }
            client.start()
        }
    }
    
    private static func send<Response: Decodable>(url: URL, httpMethod: String, middlewares: [TRPCMiddleware], contentType: String, bodyData: Data?) async throws -> Response {
        var request = URLRequest(url: url)
        request.httpMethod = httpMethod
        request.httpBody = bodyData
        request.addValue(contentType, forHTTPHeaderField: "Content-Type")
        
        for middleware in middlewares {
            request = try await middleware(request)
        }
        
        request.httpMethod = httpMethod
        request.httpBody = bodyData
        
        let response = try await URLSession.shared.data(for: request)
        let decoded = try decoder.decode(TRPCResponse<Response>.self, from: response.0)
        
        if let error = decoded.error {
            throw error
        }
        
        if let data = decoded.result?.data {
            return data
        }
        
        if Response.self == EmptyObject.self {
            guard let emptyResult = EmptyObject() as? Response else {
                throw TRPCError(code: .missingOutputPayload, message: "Cannot cast empty object to \(Response.self).", data: nil)
            }
            
            return emptyResult
        }
        
        throw TRPCError(code: .missingOutputPayload, message: "Missing output payload.", data: nil)
    }
    
    private static func createURLWithParameters<Request: Encodable>(url: URL, input: Request) throws -> URL {
        guard var components = URLComponents(url: url, resolvingAgainstBaseURL: false) else {
            throw TRPCError(code: .errorParsingUrl, message: "Could not create URLComponents from the given url: \(url)")
        }

        let data = try encoder.encode(Request.self == EmptyObject.self ? nil : input)
        
        components.queryItems = [
        URLQueryItem(name: "input", value: String(data: data, encoding: .utf8)!)
        ]
        
        let characterSet = CharacterSet(charactersIn: "/+").inverted
        guard let oldPercentEncodedQuery = components.percentEncodedQuery else {
            throw TRPCError(code: .errorParsingUrlComponents, message: "Could not retreive percent encoded URL query.")
        }
        components.percentEncodedQuery = oldPercentEncodedQuery.addingPercentEncoding(withAllowedCharacters: characterSet)
        
        guard let url = components.url else {
            throw TRPCError(code: .errorParsingUrlComponents, message: "Could not generate final URL after including parameters.")
        }
        
        return url
    }

    static func createMultipartData(input: TRPCSwiftMultipartParsable, boundary: String) throws -> Data {
        var body = Data()
        
        for (key, value) in input.jsonFields {
            guard let value = value else {
                continue
            }

            body.append("--\(boundary)\r\n".data(using: .utf8)!)
            body.append("Content-Disposition: form-data; name=\"\(key)\"\r\n".data(using: .utf8)!)
            body.append("Content-Type: application/json\r\n\r\n".data(using: .utf8)!)
            body.append(try encoder.encode(value))
            body.append("\r\n".data(using: .utf8)!)
        }
        
        for (key, file) in input.fileFields {
            guard let file = file else {
                continue
            }
            
            body.append("--\(boundary)\r\n".data(using: .utf8)!)
            body.append("Content-Disposition: form-data; name=\"\(key)\"; filename=\"\(file.filename)\"\r\n".data(using: .utf8)!)
            body.append("Content-Type: \(file.mimeType)\r\n\r\n".data(using: .utf8)!)
            body.append(file.content)
            body.append("\r\n".data(using: .utf8)!)
        }
        
        body.append("--\(boundary)--\r\n".data(using: .utf8)!)
        
        return body
    }
}
