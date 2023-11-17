import Foundation 

class AppClient: TRPCClientData {
    lazy var layer = Layer(clientData: self)
    
    var baseUrl: URL
    
    var url: URL {
        baseUrl
    }
    
    init(baseUrl: URL) {
        self.baseUrl = baseUrl
    }
    
    class Layer: TRPCClientData {
        lazy var depth = Depth(clientData: self)
        
        let clientData: TRPCClientData
        
        var url: URL {
            clientData.url.appendingPathComponent("layer")
        }
        
        init(clientData: TRPCClientData) {
            self.clientData = clientData
        }
        
        class Depth: TRPCClientData {
            let clientData: TRPCClientData
            
            var url: URL {
                clientData.url.appendingPathExtension("depth")
            }
            
            init(clientData: TRPCClientData) {
                self.clientData = clientData
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
                return try await TRPCClient.shared.sendQuery(url: url.appendingPathExtension("three"), input: input)
            }
            struct FourInputType: Codable, Equatable {
                var name: String?
            }
            
            struct FourOutputType: Codable, Equatable {
                var message: String
            }
            
            
            func four(input: FourInputType) async throws -> FourOutputType? {
                return try await TRPCClient.shared.sendQuery(url: url.appendingPathExtension("four"), input: input)
            }
        }
        struct NestedInputType: Codable, Equatable {
            var name: String?
        }
        
        struct NestedOutputType: Codable, Equatable {
            var message: String
        }
        
        
        func nested(input: NestedInputType) async throws -> NestedOutputType {
            return try await TRPCClient.shared.sendQuery(url: url.appendingPathExtension("nested"), input: input)
        }
    }
    struct HelloInputType: Codable, Equatable {
        var name: String?
    }
    
    struct HelloOutputType: Codable, Equatable {
        var message: String
    }
    
    
    func hello(input: HelloInputType) async throws -> HelloOutputType {
        return try await TRPCClient.shared.sendQuery(url: url.appendingPathExtension("hello"), input: input)
    }
}
