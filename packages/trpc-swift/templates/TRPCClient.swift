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

struct TRPCResponse<T: Decodable>: Decodable {
    struct Result: Decodable {
        let data: T?
    }
    
    let result: Result?
    let error: TRPCError?
}

public typealias TRPCMiddleware = (URLRequest) async throws -> URLRequest

class TRPCClient {
    struct EmptyObject: Codable { }
    
    static var dateFormatter: DateFormatter = {
        let formatter = DateFormatter()
        formatter.locale = Locale(identifier: "en_US_POSIX")
        formatter.dateFormat = "yyyy-MM-dd'T'HH:mm:ss.SSSZ"
        formatter.timeZone = TimeZone(secondsFromGMT: 0)
        
        return formatter
    }()
    
    static func sendQuery<Request: Encodable, Response: Decodable>(url: URL, middlewares: [TRPCMiddleware], input: Request) async throws -> Response {
        guard var components = URLComponents(url: url, resolvingAgainstBaseURL: false) else {
            throw TRPCError(code: .errorParsingUrl, message: "Could not create URLComponents from the given url: \(url)")
        }
        
        let encoder = JSONEncoder()
        encoder.dateEncodingStrategy = .formatted(dateFormatter)
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
        
        return try await send(url: url, httpMethod: "GET", middlewares: middlewares, bodyData: nil)
    }

    static func sendMutation<Request: Encodable, Response: Decodable>(url: URL, middlewares: [TRPCMiddleware], input: Request) async throws -> Response {
        let encoder = JSONEncoder()
        encoder.dateEncodingStrategy = .formatted(dateFormatter)
        let data = try encoder.encode(Request.self == EmptyObject.self ? nil : input)

        return try await send(url: url, httpMethod: "POST", middlewares: middlewares, bodyData: data)
    }

    private static func send<Response: Decodable>(url: URL, httpMethod: String, middlewares: [TRPCMiddleware], bodyData: Data?) async throws -> Response {
        var request = URLRequest(url: url)
        request.httpMethod = httpMethod
        request.httpBody = bodyData
        request.addValue("application/json", forHTTPHeaderField: "Content-Type")

        for middleware in middlewares {
            request = try await middleware(request)
        }

        request.httpMethod = httpMethod
        request.httpBody = bodyData

        let response = try await URLSession.shared.data(for: request)

        let decoder = JSONDecoder()
        decoder.dateDecodingStrategy = .formatted(dateFormatter)
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
}