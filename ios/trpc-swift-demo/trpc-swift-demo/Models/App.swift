import Foundation 

class AppClient: TRPCClientData {
    lazy var layer = Layer(clientData: self)
    
    var baseUrl: URL
    var baseMiddlewares: [TRPCMiddleware] = []
    
    var url: URL {
        baseUrl
    }
    
    var middlewares: [TRPCMiddleware] {
        baseMiddlewares
    }
    
    init(baseUrl: URL) {
        self.baseUrl = baseUrl
    }
    
    struct BigObj: Codable, Equatable {
        var name: String?
        struct Other: Codable, Equatable {
            var nest: Int
            struct Bro: Codable, Equatable {
            }
            var bro: Bro
            var arr: [String?]
            var arr2: [String?]?
        }
        var other: [Other]
    }
    
    class Layer: TRPCClientData {
        lazy var depth = Depth(clientData: self)
        
        let clientData: TRPCClientData
        
        var url: URL {
            clientData.url.appendingPathComponent("layer")
        }
        
        var middlewares: [TRPCMiddleware] {
            clientData.middlewares
        }
        
        init(clientData: TRPCClientData) {
            self.clientData = clientData
        }
        
        class Depth: TRPCClientData {
            let clientData: TRPCClientData
            
            var url: URL {
                clientData.url.appendingPathExtension("depth")
            }
            
            var middlewares: [TRPCMiddleware] {
                clientData.middlewares
            }
            
            init(clientData: TRPCClientData) {
                self.clientData = clientData
            }
            
            struct ThreeOutputType: Codable, Equatable {
                var message: String
            }
            
            
            func three(input: BigObj) async throws -> [ThreeOutputType] {
                return try await TRPCClient.shared.sendQuery(url: url.appendingPathExtension("three"), middlewares: middlewares, input: input)
            }
            struct FourInputType: Codable, Equatable {
                var name: String?
            }
            
            struct FourOutputType: Codable, Equatable {
                var message: String
            }
            
            
            func four(input: FourInputType) async throws -> FourOutputType? {
                return try await TRPCClient.shared.sendQuery(url: url.appendingPathExtension("four"), middlewares: middlewares, input: input)
            }
        }
        struct NestedInputType: Codable, Equatable {
            var name: String?
        }
        
        struct NestedOutputType: Codable, Equatable {
            var message: String
        }
        
        
        func nested(input: NestedInputType) async throws -> NestedOutputType {
            return try await TRPCClient.shared.sendQuery(url: url.appendingPathExtension("nested"), middlewares: middlewares, input: input)
        }
    }
    struct HelloInputType: Codable, Equatable {
        var name: String?
    }
    
    struct HelloOutputType: Codable, Equatable {
        var message: String
    }
    
    
    func hello(input: HelloInputType) async throws -> HelloOutputType {
        return try await TRPCClient.shared.sendQuery(url: url.appendingPathExtension("hello"), middlewares: middlewares, input: input)
    }
}
