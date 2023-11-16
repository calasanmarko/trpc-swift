import Foundation

var baseUrl: URL!

class AppClient {
    init(baseUrl newBaseUrl: URL) {
        baseUrl = newBaseUrl
    }
    
    class Layer {
        let fullPath = "layer"
        
        class Depth {
            let fullPath = "layer.depth"
            
            struct ThreeInput: Equatable, Codable {
                let name: String?
                struct OtherType: Equatable, Codable {
                    let nest: Int
                    struct BroType: Equatable, Codable {
                    }
                    
                    let bro: BroType
                    let arr: [String?]
                    let arr2: [String?]?
                }
                
                let other: [OtherType]
            }
            
            struct ThreeOutput: Equatable, Codable {
                let message: String
            }
            
            func three(input: ThreeInput) async throws -> [ThreeOutput] {
                return try await TRPCClient.shared.sendQuery(url: baseUrl.appendingPathComponent(fullPath + ".three"), input: input)
            }
            
            struct FourInput: Equatable, Codable {
                let name: String?
            }
            
            struct FourOutput: Equatable, Codable {
                let message: String
            }
            
            func four(input: FourInput) async throws -> FourOutput? {
                return try await TRPCClient.shared.sendQuery(url: baseUrl.appendingPathComponent(fullPath + ".four"), input: input)
            }
            
        }
        
        struct NestedInput: Equatable, Codable {
            let name: String?
        }
        
        struct NestedOutput: Equatable, Codable {
            let message: String
        }
        
        func nested(input: NestedInput) async throws -> NestedOutput {
            return try await TRPCClient.shared.sendQuery(url: baseUrl.appendingPathComponent(fullPath + ".nested"), input: input)
        }
        
    }
    
    struct HelloInput: Equatable, Codable {
        let name: String?
    }
    
    struct HelloOutput: Equatable, Codable {
        let message: String
    }
    
    func hello(input: HelloInput) async throws -> HelloOutput {
        return try await TRPCClient.shared.sendQuery(url: baseUrl.appendingPathComponent("hello"), input: input)
    }
    
}
