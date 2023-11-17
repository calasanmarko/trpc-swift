import Foundation 

class AppClient {
    var url: URL
    init(url: URL) {
        self.url = url
    }
    
    class Layer {
        var url: URL {
            AppClient.shared.url.appendingComponents(".layer")
        }
        
        class Depth {
            var url: URL {
                AppClient.shared.url.appendingComponents(".depth")
            }
            
            struct BigObj: Codable, Equatable {
                var name: String?
                struct OtherType: Codable, Equatable {
                    var nest: Int
                    struct BroType: Codable, Equatable {
                    }
                    var bro: BroType
                    var arr: [String?]
                    var arr2: [String?]?
                }
                var other: [OtherType]
            }
            
            struct ThreeOutputType: Codable, Equatable {
                var message: String
            }
            
            
            func three(input: BigObj) async throws -> [ThreeOutputType] {
                return try await TRPCClient.shared.sendQuery(url: url, input: input)
            }
            struct FourInputType: Codable, Equatable {
                var name: String?
            }
            
            struct FourOutputType: Codable, Equatable {
                var message: String
            }
            
            
            func four(input: FourInputType) async throws -> FourOutputType? {
                return try await TRPCClient.shared.sendQuery(url: url, input: input)
            }
        }
        struct NestedInputType: Codable, Equatable {
            var name: String?
        }
        
        struct NestedOutputType: Codable, Equatable {
            var message: String
        }
        
        
        func nested(input: NestedInputType) async throws -> NestedOutputType {
            return try await TRPCClient.shared.sendQuery(url: url, input: input)
        }
    }
    struct HelloInputType: Codable, Equatable {
        var name: String?
    }
    
    struct HelloOutputType: Codable, Equatable {
        var message: String
    }
    
    
    func hello(input: HelloInputType) async throws -> HelloOutputType {
        return try await TRPCClient.shared.sendQuery(url: url, input: input)
    }
}
