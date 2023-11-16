//
//  TRPCClient.swift
//  trpc-swift-demo
//
//  Created by Marko on 11/16/23.
//

import Foundation

struct TRPCRequest<T: Encodable>: Encodable {
    let json: T
}

struct TRPCResponse<T: Decodable>: Decodable {
    struct Result: Decodable {
        let data: T
    }
    let result: Result
}

class TRPCClient {
    static let shared = TRPCClient()
    
    func sendQuery<Request: Encodable, Response: Decodable>(url: URL, input: Request) async throws -> Response {
        var components = URLComponents(url: url, resolvingAgainstBaseURL: false)
        let data = try! JSONEncoder().encode(input)
        components?.queryItems = [
            URLQueryItem(name: "input", value: "{\"json\":\(String(data: data, encoding: .utf8)!)}")
        ]
        
        guard let url = components?.url else {
            throw NSError(domain: "", code: -1, userInfo: nil)
        }
        
        print(url)
        
        var request = URLRequest(url: url)
        request.httpMethod = "GET"
        request.setValue("application/json", forHTTPHeaderField: "Content-Type")
        
        let response = try await URLSession.shared.data(for: request)
        return try JSONDecoder().decode(TRPCResponse<Response>.self, from: response.0).result.data
    }
    
    func sendMutation<Request: Encodable, Response: Decodable>(url: URL, input: Request) async throws -> Response {
        var request = URLRequest(url: url)
        request.httpMethod = "POST"
        request.httpBody = try JSONEncoder().encode(TRPCRequest(json: input))
        
        let response = try await URLSession.shared.data(for: request)
        return try JSONDecoder().decode(TRPCResponse<Response>.self, from: response.0).result.data
    }
}
